-- 1. Create UUID Extension (Required if using UUIDs for primary keys)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Organization Table (The Tenant)
CREATE TABLE organizations (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
name VARCHAR(255) NOT NULL,
tenant_slug VARCHAR(100) NOT NULL UNIQUE,
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. User Table (Supports Super Admins, Org Admins, and Students)
CREATE TABLE users (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL, -- Nullable for Global Super Admins
email VARCHAR(255) NOT NULL UNIQUE,
password_hash VARCHAR(255) NOT NULL,
role VARCHAR(50) NOT NULL, -- SUPER_ADMIN, ORG_ADMIN, STUDENT
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Exam Table
CREATE TABLE exams (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
title VARCHAR(255) NOT NULL,
created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
end_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- 5. Question Table
CREATE TABLE questions (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
question_text TEXT NOT NULL,
correct_marks NUMERIC(4,2) NOT NULL, -- Allows decimal marking like +4.00
negative_marks NUMERIC(4,2) DEFAULT 0.00 -- Allows decimal marking like -1.00
);

-- 6. Option Table (For Multiple Choice Options)
CREATE TABLE options (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
option_text TEXT NOT NULL,
is_correct BOOLEAN NOT NULL DEFAULT FALSE
);

-- 7. Exam Submission Table (Tracks high-level exam attempts)
CREATE TABLE exam_submissions (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
submitted_at TIMESTAMP WITH TIME ZONE,
total_score NUMERIC(6,2) DEFAULT 0.00
);

-- 8. Submission Detail Table (Tracks granular choices per question)
CREATE TABLE submission_details (
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
submission_id UUID NOT NULL REFERENCES exam_submissions(id) ON DELETE CASCADE,
question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
selected_option_id UUID REFERENCES options(id) ON DELETE SET NULL
);