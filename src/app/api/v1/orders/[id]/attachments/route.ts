import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

const DEFAULT_ATTACHMENT_BUCKETS = ['order-attachment', 'order-attachments'];

function extractStorageRefFromFileUrl(fileUrl: string | null): { bucket: string; path: string } | null {
  if (!fileUrl) return null;

  const marker = '/storage/v1/object/public/';
  const markerIndex = fileUrl.indexOf(marker);

  if (markerIndex === -1) return null;

  const afterMarker = fileUrl.slice(markerIndex + marker.length);
  const [bucket, ...pathParts] = afterMarker.split('/');

  if (!bucket || pathParts.length === 0) return null;

  return {
    bucket,
    path: pathParts.join('/'),
  };
}

function normalizeStoragePath(path: string | null): string | null {
  return typeof path === 'string' ? path.trim() || null : null;
}

function candidateRefs(storagePath: string | null, fileUrl: string | null): Array<{ bucket: string; path: string }> {
  const refs: Array<{ bucket: string; path: string }> = [];
  const normalizedPath = normalizeStoragePath(storagePath);
  const refFromUrl = extractStorageRefFromFileUrl(fileUrl);

  if (refFromUrl) {
    refs.push(refFromUrl);
  }

  if (normalizedPath) {
    const [firstSegment, ...restSegments] = normalizedPath.split('/');
    if (firstSegment && restSegments.length > 0 && DEFAULT_ATTACHMENT_BUCKETS.includes(firstSegment)) {
      refs.push({ bucket: firstSegment, path: restSegments.join('/') });
    } else {
      for (const bucket of DEFAULT_ATTACHMENT_BUCKETS) {
        refs.push({ bucket, path: normalizedPath });
      }
    }
  }

  return refs.filter((ref, index, arr) =>
    Boolean(ref.bucket && ref.path) &&
    arr.findIndex((other) => other.bucket === ref.bucket && other.path === ref.path) === index
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: attachments, error } = await supabaseAdmin
      .from('order_attachments')
      .select('*')
      .eq('order_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching attachments:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener archivos adjuntos' },
        { status: 500 }
      );
    }

    const normalizedAttachments = await Promise.all((attachments || []).map(async (attachment) => {
      const refs = candidateRefs(attachment.storage_path, attachment.file_url);

      if (refs.length === 0) {
        return attachment;
      }

      for (const ref of refs) {
        const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
          .from(ref.bucket)
          .createSignedUrl(ref.path, 60 * 10);

        if (!signedUrlError && signedUrlData?.signedUrl) {
          return {
            ...attachment,
            storage_path: ref.path,
            file_url: signedUrlData.signedUrl,
          };
        }

        const { data: publicUrlData } = supabaseAdmin.storage
          .from(ref.bucket)
          .getPublicUrl(ref.path);

        if (publicUrlData?.publicUrl) {
          return {
            ...attachment,
            storage_path: ref.path,
            file_url: publicUrlData.publicUrl,
          };
        }
      }

      return attachment;
    }));

    return NextResponse.json({
      success: true,
      attachments: normalizedAttachments
    });
  } catch (error) {
    console.error('Error in attachments endpoint:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
