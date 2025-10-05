// Modern React with TypeScript
import React, { useEffect, useRef } from 'react';

interface Props {
  onCopy?: (text: string) => void;
}

const ModernComponent: React.FC<Props> = ({ onCopy }) => {
  const abortControllerRef = useRef<AbortController>();

  useEffect(() => {
    // Set up AbortController
    abortControllerRef.current = new AbortController();
    
    // Fetch data with abort signal
    fetchData('/api/data', abortControllerRef.current.signal)
      .then(data => console.log('Data loaded:', data))
      .catch(error => {
        if (error.name !== 'AbortError') {
          console.error('Fetch error:', error);
        }
      });

    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText('Copied text');
      onCopy?.('Copied text');
    } catch (err) {
      console.error('Clipboard error:', err);
    }
  };

  const handleFetch = async () => {
    try {
      const response = await fetch('/api/data');
      const data = await response.json();
      console.log('Fetched:', data);
    } catch (error) {
      console.error('Fetch failed:', error);
    }
  };

  return (
    <div className="grid-container">
      <header className="item:has(.icon)">
        <button onClick={handleCopy}>Copy Text</button>
        <button onClick={handleFetch}>Fetch Data</button>
      </header>
      <main>
        <p>Modern React component with advanced features</p>
      </main>
    </div>
  );
};

async function fetchData(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  return response.json();
}

export default ModernComponent;
