import React, { useState } from 'react';

export const Logo = ({ className = "w-24 h-24" }: { className?: string }) => {
  const [error, setError] = useState(false);
  const primaryLogo = "https://i.postimg.cc/Z0Z5kqHx/logo.png";

  if (error) {
    return (
      <div className={`${className} bg-amber-50 rounded-full flex flex-col items-center justify-center border border-amber-100 p-2 text-center`}>
        <span className="text-[10px] font-serif font-bold text-amber-900 leading-tight">ASHAPURNA</span>
      </div>
    );
  }

  return (
    <img 
      src={primaryLogo} 
      alt="Ashapurna Logo" 
      className={className}
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
    />
  );
};
