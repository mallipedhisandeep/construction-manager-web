-- ============================================================
-- Attendance running-balance integrity (fixes F1 / P3 / P4)
--
-- Previously, balance_after was computed client-side by fetching a
-- worker's whole attendance history into JS on every single save, and
-- editing an earlier date never cascaded forward to fix later dates'
-- already-stored balance_after — it silently went stale until someone
-- pressed a manual "recalculate" button.
--
-- This moves the calculation into Postgres as a single set-based
-- operation, run automatically by a trigger after every insert/update/
-- delete, so balance_after is *always* consistent and the client no
-- longer needs to fetch any historical rows just to save one day.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalc_attendance_balance(p_worker_id UUID, p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  WITH running AS (
    SELECT id,
           SUM(CASE WHEN attendance_type <> 'Absent' THEN wage ELSE 0 END)
             OVER (ORDER BY date_key, id)
           - SUM(advance) OVER (ORDER BY date_key, id) AS new_balance
    FROM public.attendance
    WHERE worker_id = p_worker_id AND user_id = p_user_id
  )
  UPDATE public.attendance a
  SET balance_after = running.new_balance
  FROM running
  WHERE a.id = running.id
    AND a.balance_after IS DISTINCT FROM running.new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_attendance_balance()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_attendance_balance(OLD.worker_id, OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_attendance_balance(NEW.worker_id, NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS attendance_balance_trigger ON public.attendance;

-- Scoped to these specific columns (not balance_after itself) so the
-- recalc function's own UPDATE of balance_after never re-fires this
-- trigger and recurses.
CREATE TRIGGER attendance_balance_trigger
AFTER INSERT OR DELETE OR UPDATE OF wage, advance, attendance_type, date_key
ON public.attendance
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_attendance_balance();

-- Callable from the client to force-resync a worker's balances (e.g. for
-- data that existed before this migration ran). Always scoped to the
-- caller's own uid — never trusts a user_id passed from the client —
-- and the UPDATE inside recalc_attendance_balance is additionally bound
-- by the attendance table's own RLS policy regardless.
CREATE OR REPLACE FUNCTION public.recalc_my_worker_balance(p_worker_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  PERFORM public.recalc_attendance_balance(p_worker_id, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_my_worker_balance(UUID) TO authenticated;
