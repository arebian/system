-- Keep the private proof bucket aligned with the proof uploader's 35 MiB
-- limit and the PHOTO / VIDEO evidence types accepted by the UI.
update storage.buckets
set file_size_limit = 36700160,
    allowed_mime_types = array[
      'image/jpeg',
      'image/png',
      'image/webp',
      'video/mp4',
      'video/webm',
      'video/quicktime'
    ]
where id = 'proofs';
