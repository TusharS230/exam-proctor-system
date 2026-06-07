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


// database connection
1. What does spring.jpa.hibernate.ddl-auto=update do? (DBMS Automation)
In simple beginner apps, developers manually create tables in pgAdmin 
using SQL scripts before writing code. In modern enterprise Spring development, 
Hibernate (our ORM engine) handles this.

When you boot the server, Hibernate scans your Java project for classes decorated 
with the @Entity annotation. If it finds a new class (like Organization.java), 
it automatically writes and fires a native SQL statement (CREATE TABLE...) 
across the network port to PostgreSQL. If you add a new column field to your 
Java class later, it executes an ALTER TABLE... statement on the fly without 
erasing your existing sample records.

2. Network Sockets & Port Mapping (Computer Networks)
localhost: A loopback network shortcut interface network address (127.0.0.1). 
It tells your Operating System's network stack to bypass the physical router 
hardware card entirely and direct traffic directly back inward to software running 
on the exact same host system.

5432: The standard TCP listener port registered globally for PostgreSQL. 
Think of your computer as a large corporate office building and ports as individual 
office desk extensions. Incoming data traffic directed to your computer's IP address 
checks the port token extension to ensure it routes directly to the PostgreSQL engine 
process rather than your browser or system audio stack.