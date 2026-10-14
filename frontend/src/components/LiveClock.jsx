import React, { useState, useEffect } from 'react';

export default function LiveClock({ showBanner = true }) {
  const [timeState, setTimeState] = useState({ timeStr: '--:--:-- --', dateStr: 'Loading...' });

  useEffect(() => {
    function update() {
      const now = new Date();
      // Calculate PHT (UTC+8)
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      const pht = new Date(utc + (8 * 3600000));
      
      let h = pht.getHours();
      const m = pht.getMinutes();
      const s = pht.getSeconds();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      if (h === 0) h = 12;

      const timeStr = `${h < 10 ? '0' : ''}${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s} ${ampm}`;
      
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const dateStr = `${days[pht.getDay()]}, ${months[pht.getMonth()]} ${pht.getDate()}, ${pht.getFullYear()}`;

      setTimeState({ timeStr, dateStr });
    }

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!showBanner) {
    return (
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
        {timeState.timeStr}
      </span>
    );
  }

  return (
    <div className="clock-banner">
      <div className="clock-digits">{timeState.timeStr}</div>
      <div className="clock-date-str">{timeState.dateStr}</div>
      <div className="clock-timezone-badge">Philippine Standard Time (UTC+8)</div>
    </div>
  );
}
