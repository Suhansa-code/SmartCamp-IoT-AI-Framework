"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to child page as the main landing page
    router.push('/child');
  }, [router]);

  // Show loading while redirecting
  return (
    <div style={{
      minHeight: '100svh',
      background: '#F0F9FF',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        border: '5px solid #0D9488',
        borderTopColor: 'transparent',
        animation: 'spin 0.75s linear infinite'
      }} />
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}
