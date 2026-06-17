import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Search from './pages/Search';
import Library from './pages/Library';
import Playlist from './pages/Playlist';
import Playlists from './pages/Playlists';
import Admin from './pages/Admin';
import Servers from './pages/Servers';
import Artists from './pages/Artists';
import ArtistPage from './pages/ArtistPage';
import AlbumPage from './pages/AlbumPage';
import Liked from './pages/Liked';

const App = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/library" element={<Library />} />
        <Route path="/artists" element={<Artists />} />
        <Route path="/playlists" element={<Playlists />} />
        <Route path="/playlist/:id" element={<Playlist />} />
        <Route path="/liked" element={<Liked />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/servers" element={<Servers />} />
        <Route path="/artist/:id" element={<ArtistPage />} />
        <Route path="/album/:artistId/:albumName" element={<AlbumPage />} />
      </Route>
    </Routes>
  );
};

export default App;
