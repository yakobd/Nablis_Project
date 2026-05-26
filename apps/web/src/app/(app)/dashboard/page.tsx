'use client';

import { useAuth } from '@nablis/shared/firebase';

export default function DashboardPage() {
  const { user, role } = useAuth();

  if (role === 'admin') {
    return (
      <div>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1B2E6B' }}>Dashboard</h1>
          <p style={{ color: '#6B7280' }}>Welcome back, {user?.displayName || 'Admin'}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          {[
            { label: 'Total Members', value: '1,240', change: '+12% this month' },
            { label: 'This Week Events', value: '8', change: '+2 this month' },
            { label: 'Prayer Requests', value: '34', change: '+5 this month' },
            { label: 'Attendance Rate', value: '87%', change: '+3% this month' },
          ].map((stat) => (
            <div key={stat.label} style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>{stat.label}</p>
              <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1B2E6B', marginBottom: '4px' }}>{stat.value}</p>
              <p style={{ fontSize: '12px', color: '#10B981' }}>{stat.change}</p>
            </div>
          ))}
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1B2E6B', marginBottom: '16px' }}>Upcoming Appointments</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                {['Member', 'Service', 'Date', 'Status'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: '#6B7280', fontWeight: '600' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { member: 'Mekdes Abebe', service: 'Confession', date: 'Oct 12, 10:00 AM', status: 'Pending' },
                { member: 'Dawit Haile', service: 'Counseling', date: 'Oct 15, 2:00 PM', status: 'Confirmed' },
                { member: 'Sara Tefera', service: 'Marriage', date: 'Oct 17, 4:00 PM', status: 'Confirmed' },
              ].map((row) => (
                <tr key={row.member} style={{ borderBottom: '1px solid #F3F4F6' }}>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>{row.member}</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>{row.service}</td>
                  <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>{row.date}</td>
                  <td style={{ padding: '12px' }}>
                    <span style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                      backgroundColor: row.status === 'Pending' ? '#FEF3C7' : '#D1FAE5',
                      color: row.status === 'Pending' ? '#92400E' : '#065F46' }}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1B2E6B' }}>Dashboard</h1>
        <p style={{ color: '#6B7280' }}>Welcome back, {user?.displayName || 'Member'}</p>
      </div>

      <div style={{ backgroundColor: '#1B2E6B', borderRadius: '12px', padding: '24px', color: '#ffffff', marginBottom: '16px' }}>
        <p style={{ fontSize: '12px', opacity: 0.7, marginBottom: '8px' }}>MORNING REFLECTION</p>
        <p style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>"Pray without ceasing."</p>
        <p style={{ fontSize: '14px', opacity: 0.8 }}>— 1 Thessalonians 5:17</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '16px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1B2E6B', marginBottom: '16px' }}>Daily Prayer Commitments</h2>
          {[
            { name: 'Morning Prayer', time: '6:00 AM', status: 'COMPLETED' },
            { name: 'Afternoon Prayer', time: '12:30 PM', status: 'UP NEXT' },
            { name: 'Evening Prayer', time: '9:00 PM', status: 'SCHEDULED' },
          ].map((prayer) => (
            <div key={prayer.name} style={{ padding: '16px', borderRadius: '8px', border: '1px solid #E5E7EB', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <p style={{ fontWeight: '600', color: '#1B2E6B' }}>{prayer.name}</p>
                  <p style={{ fontSize: '12px', color: '#6B7280' }}>{prayer.time}</p>
                </div>
                <span style={{ padding: '4px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                  backgroundColor: prayer.status === 'COMPLETED' ? '#D1FAE5' : prayer.status === 'UP NEXT' ? '#FEF3C7' : '#F3F4F6',
                  color: prayer.status === 'COMPLETED' ? '#065F46' : prayer.status === 'UP NEXT' ? '#92400E' : '#6B7280' }}>
                  {prayer.status}
                </span>
              </div>
              {prayer.status === 'UP NEXT' && (
                <button style={{ width: '100%', padding: '8px', backgroundColor: '#1B2E6B', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                  + Mark as Prayed
                </button>
              )}
            </div>
          ))}
        </div>

        <div>
          <div style={{ backgroundColor: '#F5C518', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <p style={{ fontSize: '12px', fontWeight: '600', marginBottom: '8px' }}>99 Verse of the Day</p>
            <p style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>"But seek first the kingdom of God and his righteousness, and all these things will be added to you."</p>
            <p style={{ fontSize: '12px', fontWeight: '600' }}>Matthew 6:33</p>
          </div>
        </div>
      </div>
    </div>
  );
}
