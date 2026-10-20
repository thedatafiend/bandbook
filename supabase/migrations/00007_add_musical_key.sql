-- Musical key, stored as a tonic pitch class (0 = C … 11 = B) plus mode so
-- spelling (sharps vs. flats) is a display concern and transposing is
-- arithmetic.

-- Song-level key: user-owned, like bpm. Nullable — many songs won't have one.
alter table songs add column key_tonic smallint;
alter table songs add column key_mode text;

alter table songs add constraint songs_key_tonic_range
  check (key_tonic is null or (key_tonic >= 0 and key_tonic <= 11));
alter table songs add constraint songs_key_mode_valid
  check (key_mode is null or key_mode in ('major', 'minor'));
alter table songs add constraint songs_key_complete
  check ((key_tonic is null) = (key_mode is null));

-- Per-version key estimated from the audio in the browser. Kept on the
-- version (not the song) because takes can be transposed, and kept separate
-- from the song key so detection never overwrites what the band entered.
alter table versions add column detected_key_tonic smallint;
alter table versions add column detected_key_mode text;
alter table versions add column key_confidence real;

alter table versions add constraint versions_detected_key_tonic_range
  check (detected_key_tonic is null or (detected_key_tonic >= 0 and detected_key_tonic <= 11));
alter table versions add constraint versions_detected_key_mode_valid
  check (detected_key_mode is null or detected_key_mode in ('major', 'minor'));
alter table versions add constraint versions_key_confidence_range
  check (key_confidence is null or (key_confidence >= 0 and key_confidence <= 1));
alter table versions add constraint versions_detected_key_complete
  check (
    (detected_key_tonic is null) = (detected_key_mode is null)
    and (detected_key_tonic is null) = (key_confidence is null)
  );
