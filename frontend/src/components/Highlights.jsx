import { useState } from 'react'
import styles from './Highlights.module.css'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const PERSONA_WINDOW = {
  'Night Owl': 'after midnight',
  'Early Bird': 'in the morning',
  'Daydreamer': 'in the afternoon',
  'Sunset Chaser': 'in the evening',
  'Midnight Wanderer': 'late at night',
}

function formatMinutes(mins) {
  const h = Math.floor(Math.round(mins) / 60)
  const m = Math.round(mins) % 60
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function Art({ src }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) return <div className={styles.artFallback}>🎵</div>
  return <img src={src} alt="" className={styles.art} loading="lazy" onError={() => setFailed(true)} />
}

function Card({ label, wide, children }) {
  return (
    <div className={`${styles.card} ${wide ? styles.wide : ''}`}>
      <p className={styles.label}>{label}</p>
      {children}
    </div>
  )
}

// Spotify-Wrapped-style extras. `period` is "month" or "year".
export default function Highlights({ highlights, throwback, period = 'month' }) {
  if (!highlights) return null
  const { persona, discovery, on_repeat, biggest_day, longest_session, listening_streak } = highlights

  return (
    <div className={styles.section}>
      <div className={styles.sectionLabel}>Highlights</div>
      <div className={styles.grid}>

        {persona && (
          <Card label="Your listening personality" wide>
            <div className={styles.persona}>
              <span className={styles.personaEmoji}>{persona.emoji}</span>
              <div>
                <h3 className={styles.personaName}>{persona.name}</h3>
                <p className={styles.sub}>
                  {persona.blurb} <strong>{persona.share}%</strong> of your listening happened {PERSONA_WINDOW[persona.name]}.
                </p>
              </div>
            </div>
          </Card>
        )}

        {discovery && !discovery.first_period && (
          <Card label="Discoveries">
            <p className={styles.big}>
              {discovery.new_artists}<span className={styles.unit}>new artists</span>
            </p>
            <p className={styles.sub}>
              and <strong>{discovery.new_songs}</strong> songs you'd never played before. {discovery.new_song_share}% of this {period}'s plays were new to you.
            </p>
            {discovery.top_new_artist && (
              <p className={styles.footnote}>
                Top discovery: <strong>{discovery.top_new_artist.name}</strong> · {formatMinutes(discovery.top_new_artist.minutes)}
              </p>
            )}
          </Card>
        )}

        {on_repeat && (
          <Card label="On repeat">
            <div className={styles.track}>
              <Art src={on_repeat.image} />
              <div className={styles.trackText}>
                <span className={styles.trackName} title={on_repeat.name}>{on_repeat.name}</span>
                <span className={styles.trackArtist} title={on_repeat.artist}>{on_repeat.artist}</span>
              </div>
            </div>
            <p className={styles.sub}>
              You played it <strong>{on_repeat.plays} times</strong> on {on_repeat.date} alone.
            </p>
          </Card>
        )}

        {biggest_day && (
          <Card label="Biggest day">
            <p className={styles.big}>{biggest_day.date}</p>
            <p className={styles.sub}>
              A {biggest_day.weekday} with <strong>{formatMinutes(biggest_day.minutes)}</strong> of music across {biggest_day.plays} plays.
            </p>
          </Card>
        )}

        {longest_session && (
          <Card label="Longest session">
            <p className={styles.big}>{formatMinutes(longest_session.minutes)}</p>
            <p className={styles.sub}>
              <strong>{longest_session.tracks} tracks</strong> back-to-back on {longest_session.date}, starting at {longest_session.start}.
            </p>
          </Card>
        )}

        {listening_streak && listening_streak.days > 1 && (
          <Card label="Listening streak">
            <p className={styles.big}>
              {listening_streak.days}<span className={styles.unit}>days</span>
            </p>
            <p className={styles.sub}>
              in a row with music, from {listening_streak.start} to {listening_streak.end}.
            </p>
          </Card>
        )}

        {throwback && (
          <Card label="Throwback">
            <p className={styles.trackName} title={throwback.song}>{throwback.song}</p>
            <p className={styles.trackArtist}>{throwback.artist}</p>
            <p className={styles.sub}>
              You played it <strong>{throwback.plays_then} times</strong> in {MONTHS[Number(throwback.ref_month.split('-')[1]) - 1]}
              {throwback.plays_now ? `, and only ${throwback.plays_now} this month.` : ', and not once this month.'}
            </p>
          </Card>
        )}

      </div>
    </div>
  )
}
