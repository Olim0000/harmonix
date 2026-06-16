import React from 'react';
import Sidebar from '../components/Sidebar';
import Player from '../components/Player';

const Playlist = () => {
  // Add logic to fetch playlist tracks

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <main style={{ flex: 1, padding: '20px' }}>
        {/* Add playlist tracks display */}
      </main>
      <Player />
    </div>
  );
};

export default Playlist;
