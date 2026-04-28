-- Increase file size limit to 100 MB on all upload buckets used by freelancers
-- 100 MB = 100 * 1024 * 1024 = 104857600 bytes

UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE name IN ('deliverables', 'menu-submissions');
