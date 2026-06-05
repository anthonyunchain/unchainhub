-- Multiple / split deliveries for video items (editorial_content), mirroring the
-- standalone `projects` delivery model. `delivery_files` accumulates across
-- deliveries; entries are grouped into "Delivery #N" batches by their `batch`
-- timestamp (all entries delivered in one action share the same batch).
--
-- Entry shapes:
--   file: { kind: 'file', path, name, size, uploaded_at, batch }   (deliverables bucket, signed URL)
--   link: { kind: 'link', url,  name,       uploaded_at, batch }   (opened directly)
ALTER TABLE editorial_content
  ADD COLUMN IF NOT EXISTS delivery_files jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill the previous single final_file_url into a first delivery batch so
-- earlier deliveries aren't lost, then clear it — delivery_files is now the
-- single source for editor deliveries.
UPDATE editorial_content
SET delivery_files = jsonb_build_array(
      jsonb_build_object(
        'kind', 'link',
        'url', final_file_url,
        'name', COALESCE(NULLIF(final_file_name, ''), 'Delivery'),
        'uploaded_at', to_jsonb(COALESCE(updated_at, now())),
        'batch', to_jsonb(COALESCE(updated_at, now()))
      )
    ),
    final_file_url = NULL,
    final_file_name = NULL
WHERE final_file_url IS NOT NULL
  AND (delivery_files IS NULL OR jsonb_array_length(delivery_files) = 0);
