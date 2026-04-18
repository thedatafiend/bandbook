-- Add song-level BPM (tempo in beats per minute).
-- Nullable: songs may not have a known tempo yet.
alter table songs add column bpm integer;

alter table songs add constraint songs_bpm_range check (bpm is null or (bpm > 0 and bpm <= 999));
