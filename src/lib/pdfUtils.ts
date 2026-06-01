import { PDFDocument } from 'pdf-lib';

export async function mergeFilesToPdf(files: File[], filename: string = 'merged.pdf'): Promise<void> {
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();

    if (file.type === 'application/pdf') {
      const pdf = await PDFDocument.load(arrayBuffer);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    } else if (file.type.startsWith('image/')) {
      let image;
      if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        image = await mergedPdf.embedJpg(arrayBuffer);
      } else if (file.type === 'image/png') {
        image = await mergedPdf.embedPng(arrayBuffer);
      }

      if (image) {
        const page = mergedPdf.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }
    }
  }

  const mergedPdfFile = await mergedPdf.save();
  const blob = new Blob([mergedPdfFile as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function mergeUrlsToPdf(urls: { url: string, name: string }[], filename: string = 'merged.pdf'): Promise<void> {
  const files: File[] = [];
  
  for (const { url, name } of urls) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const file = new File([blob], name, { type: blob.type });
      files.push(file);
    } catch (error) {
      console.error(`Error fetching file ${name}:`, error);
    }
  }
  
  await mergeFilesToPdf(files, filename);
}
