import { useState } from 'react';
import { QrReader } from 'react-qr-reader';

export default function QRScanner({ onComplete }) {
  const [child, setChild] = useState(null);

  const handleScan = async (result) => {
    if (result?.text) {
      console.log("Scanned:", result.text);
      try {
        const res = await fetch(`/api/child/${result.text}`);
        const data = await res.json();
        if (data.success) {
          setChild(data.child);
          // Call onComplete callback if provided
          if (typeof onComplete === 'function') {
            setTimeout(() => onComplete(data.child), 1000);
          }
        } else {
          alert("Child not found");
        }
      } catch (err) {
        console.error("Error fetching child:", err);
      }
    }
  };

  return (
    <div>
      <h2>Scan Child QR Code</h2>
      <QrReader
        onResult={(result, error) => {
          if (!!result) handleScan(result);
          if (!!error) console.error(error);
        }}
        style={{ width: '300px' }}
      />
      {child && (
        <div>
          <h3>{child.child_id}</h3>
          <p>Grade: {child.grade}</p>
          <p>Camp: {child.camp_id}</p>
          <p>Zone: {child.zone_id}</p>
        </div>
      )}
    </div>
  );
}
