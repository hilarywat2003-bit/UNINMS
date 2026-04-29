-- Merge the researcher role into lecturer.
-- Lecturers and researchers are the same user population on this platform.
UPDATE users SET role = 'lecturer' WHERE role = 'researcher';
