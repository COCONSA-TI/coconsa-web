# Manual Setup Instructions for Order Attachments Feature

## 1. Apply Database Migration

**Option A: Via Supabase SQL Editor (Recommended)**
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New Query"
4. Copy and paste the contents of: `supabase/migrations/create_order_attachments.sql`
5. Click "Run" to execute

**Option B: Via psql (if installed)**
```bash
psql "postgresql://..." -f supabase/migrations/create_order_attachments.sql
```

## 2. Create Storage Bucket

1. Go to your Supabase project dashboard
2. Click on "Storage" in the left sidebar
3. Click "Create a new bucket"
4. Configure the bucket:
   - **Name**: `order-attachments`
   - **Public bucket**: ❌ No (keep private)
   - **File size limit**: 10 MB (10485760 bytes)
   - **Allowed MIME types**: 
     - `application/pdf`
     - `image/jpeg`
     - `image/png`
     - `image/jpg`
     - `application/vnd.ms-excel`
     - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
     - `application/msword`
     - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
5. Click "Create bucket"

## 3. Set Storage Policies (Important!)

After creating the bucket, you need to add policies for access:

1. Click on the `order-attachments` bucket
2. Go to "Policies" tab
3. Add the following policies via SQL Editor:

```sql
-- Policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'order-attachments');

-- Policy: Allow authenticated users to read files
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'order-attachments');

-- Policy: Allow users to delete their own uploads (optional)
CREATE POLICY "Allow users to delete own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'order-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## After Setup

Once both steps are complete, you can delete this file. The application will be able to:
- Upload attachments when Contraloría approves orders
- Store files securely in Supabase Storage
- Track file metadata in the `order_attachments` table
