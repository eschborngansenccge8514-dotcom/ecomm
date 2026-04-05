-- Unscheduling marketplace job-runner cron job
-- This identifier matches the command found during research: https://functions-worker.jjooi1707.workers.dev/marketplace/job-runner

DO $$
BEGIN
    -- Unschedule the job by matching the command substring
    -- Using the job description if it's named, or the command string
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE command LIKE '%marketplace/job-runner%';
    
    -- Also attempt to unschedule by jobid 11 if it still exists (safety fallback)
    -- But command match is more robust across different environments
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = 11) THEN
        PERFORM cron.unschedule(11);
    END IF;
END $$;
