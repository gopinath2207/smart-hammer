import { useState, useEffect } from 'react';

const CountdownTimer = ({ endTime, onEnd }) => {
  const calc = () => {
    const diff = new Date(endTime) - new Date();
    if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, done: true };
    return {
      d    : Math.floor(diff / 86400000),
      h    : Math.floor((diff % 86400000) / 3600000),
      m    : Math.floor((diff % 3600000)  / 60000),
      s    : Math.floor((diff % 60000)    / 1000),
      done : false,
    };
  };

  const [time, setTime] = useState(calc);

  useEffect(() => {
    if (time.done) { onEnd?.(); return; }
    const t = setInterval(() => {
      const next = calc();
      setTime(next);
      if (next.done) { clearInterval(t); onEnd?.(); }
    }, 1000);
    return () => clearInterval(t);
  }, [endTime]);

  if (time.done) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <p className="text-red-600 font-semibold text-lg">Auction Ended</p>
      </div>
    );
  }

  const isUrgent = time.d === 0 && time.h === 0 && time.m < 15;

  const Box = ({ val, label }) => (
    <div className={`flex flex-col items-center px-4 py-3 rounded-xl
      ${isUrgent ? 'bg-red-50' : 'bg-blue-50'}`}>
      <span className={`text-2xl font-bold
        ${isUrgent ? 'text-red-600' : 'text-blue-600'}`}>
        {String(val).padStart(2, '0')}
      </span>
      <span className="text-xs text-gray-500 mt-1">{label}</span>
    </div>
  );

  return (
    <div>
      {isUrgent && (
        <p className="text-red-500 text-sm font-medium text-center mb-2
          animate-pulse">
          Ending soon!
        </p>
      )}
      <div className="flex gap-3 justify-center">
        {time.d > 0 && <Box val={time.d} label="Days"  />}
        <Box val={time.h} label="Hours"   />
        <Box val={time.m} label="Minutes" />
        <Box val={time.s} label="Seconds" />
      </div>
    </div>
  );
};

export default CountdownTimer;