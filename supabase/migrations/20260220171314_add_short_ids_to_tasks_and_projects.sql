-- Add short_id column to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

-- Add short_id column to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS short_id TEXT UNIQUE;

-- Create a function to generate short IDs if they don't exist
CREATE OR REPLACE FUNCTION generate_short_id() RETURNS TEXT AS $$
DECLARE
    new_id TEXT;
    done BOOL;
BEGIN
    done := FALSE;
    WHILE NOT done LOOP
        new_id := substr(md5(random()::text), 1, 8);
        -- Check projects
        IF NOT EXISTS (SELECT 1 FROM projects WHERE short_id = new_id) AND
           NOT EXISTS (SELECT 1 FROM tasks WHERE short_id = new_id) THEN
            done := TRUE;
        END IF;
    END LOOP;
    RETURN new_id;
END;
$$ LANGUAGE plpgsql;

-- Populate existing projects
UPDATE projects SET short_id = generate_short_id() WHERE short_id IS NULL;

-- Populate existing tasks
UPDATE tasks SET short_id = generate_short_id() WHERE short_id IS NULL;

-- Add a trigger to auto-populate short_id for new records
CREATE OR REPLACE FUNCTION set_short_id() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.short_id IS NULL THEN
        NEW.short_id := generate_short_id();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_projects_short_id ON projects;
CREATE TRIGGER tr_projects_short_id
BEFORE INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION set_short_id();

DROP TRIGGER IF EXISTS tr_tasks_short_id ON tasks;
CREATE TRIGGER tr_tasks_short_id
BEFORE INSERT ON tasks
FOR EACH ROW
EXECUTE FUNCTION set_short_id();
;
