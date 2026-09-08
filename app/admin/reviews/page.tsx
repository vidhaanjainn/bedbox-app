'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { Star, MessageSquare } from 'lucide-react'

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ratingFilter, setRatingFilter] = useState<number | 'all'>('all')
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('residents')
      .select('id, name, room_number, exit_review_rating, exit_review_comment, exit_review_submitted_at, would_readmit, is_test_account')
      .not('exit_review_submitted_at', 'is', null)
      .order('exit_review_submitted_at', { ascending: false })
      .then(({ data }) => {
        setReviews((data || []).filter(r => !r.is_test_account))
        setLoading(false)
      })
  }, [])

  const total = reviews.length
  const average = total > 0 ? reviews.reduce((s, r) => s + r.exit_review_rating, 0) / total : 0
  const distribution = [5, 4, 3, 2, 1].map(n => ({
    stars: n,
    count: reviews.filter(r => r.exit_review_rating === n).length,
  }))
  const filtered = ratingFilter === 'all' ? reviews : reviews.filter(r => r.exit_review_rating === ratingFilter)

  return (
    <div style={{ padding: '32px', maxWidth: '900px' }} className="animate-fade-in">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '26px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 6px' }}>Resident Reviews</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>What residents said when they left - the one honest signal that can't be gamed.</p>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : total === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center' }}>
          <MessageSquare size={40} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>No reviews yet - they show up here once a vacated resident submits one from their portal.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="glass-card" style={{ padding: '28px', marginBottom: '24px', display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', fontWeight: '700', fontFamily: 'Syne, sans-serif', color: 'var(--text-primary)', lineHeight: 1 }}>{average.toFixed(1)}</div>
              <div style={{ display: 'flex', gap: 2, justifyContent: 'center', margin: '8px 0 4px' }}>
                {[1, 2, 3, 4, 5].map(n => <Star key={n} size={14} fill={n <= Math.round(average) ? '#fbbf24' : 'none'} color={n <= Math.round(average) ? '#fbbf24' : 'var(--text-muted)'} />)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{total} review{total === 1 ? '' : 's'}</div>
            </div>
            <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {distribution.map(d => (
                <div key={d.stars} onClick={() => setRatingFilter(ratingFilter === d.stars ? 'all' : d.stars)} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '32px', flexShrink: 0 }}>{d.stars} ★</span>
                  <div style={{ flex: 1, height: '8px', borderRadius: '999px', background: 'var(--surface-3)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${total > 0 ? (d.count / total) * 100 : 0}%`, background: ratingFilter === d.stars ? '#fbbf24' : 'rgba(251,191,36,0.5)', borderRadius: '999px', transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '20px', textAlign: 'right', flexShrink: 0 }}>{d.count}</span>
                </div>
              ))}
              {ratingFilter !== 'all' && (
                <button onClick={() => setRatingFilter('all')} style={{ alignSelf: 'flex-start', fontSize: 11, color: 'var(--teal-500)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 0' }}>Clear filter</button>
              )}
            </div>
          </div>

          {/* Individual reviews */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(r => (
              <div key={r.id} className="glass-card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: r.exit_review_comment ? '8px' : 0 }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>{r.name}{r.room_number ? ` · Room ${r.room_number}` : ''}</div>
                    <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                      {[1, 2, 3, 4, 5].map(n => <Star key={n} size={13} fill={n <= r.exit_review_rating ? '#fbbf24' : 'none'} color={n <= r.exit_review_rating ? '#fbbf24' : 'var(--text-muted)'} />)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(r.exit_review_submitted_at)}</div>
                    {r.would_readmit !== null && (
                      <div style={{ fontSize: '10px', fontWeight: '600', color: r.would_readmit ? '#34d399' : '#f87171', marginTop: '4px' }}>
                        {r.would_readmit ? 'Would re-admit' : 'Would not re-admit'}
                      </div>
                    )}
                  </div>
                </div>
                {r.exit_review_comment && (
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0, lineHeight: 1.6 }}>"{r.exit_review_comment}"</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
