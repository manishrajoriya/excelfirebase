import { useState } from 'react';
import { auth } from './firebase/config';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [user, setUser] = useState(auth.currentUser);

  // Listen for auth state changes
  auth.onAuthStateChanged((user) => {
    setUser(user);
  });

  if (!user) {
    return (
      <div className="app">
        <Auth />
      </div>
    );
  }

  return (
    <div className="app-authenticated">
      <Sidebar 
        userEmail={user.email} 
        onSignOut={() => auth.signOut()} 
      />
      <Dashboard />
    </div>
  );
}

export default App;
