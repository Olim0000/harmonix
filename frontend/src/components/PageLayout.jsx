import React from 'react';
import Sidebar from './Sidebar';
import Player from './Player';

const PageLayout = ({ children }) => (
  <>
    <div className="app-shell">
      <Sidebar />
      <main className="content">
        {children}
      </main>
    </div>
    <Player />
  </>
);

export default PageLayout;