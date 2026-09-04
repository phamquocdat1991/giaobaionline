ALTER TABLE `classrooms` ADD `owner_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_classrooms_owner_email` ON `classrooms` (`owner_email`);--> statement-breakpoint
CREATE INDEX `idx_quizzes_teacher_email` ON `quizzes` (`teacher_email`);