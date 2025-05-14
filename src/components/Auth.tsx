import { useState } from 'react';
import { auth, db } from '../firebase/config';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import './Auth.css';

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(auth.currentUser);

  // Listen for auth state changes
  auth.onAuthStateChanged((user) => {
    setUser(user);
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        // Login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('Logged in:', userCredential.user);
      } else {
        // Sign up
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Create a user document in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString()
        });
        
        console.log('Signed up:', userCredential.user);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('Signed out successfully');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (user) {
    return (
      <div className="auth-container">
        <h2>Welcome, {user.email}</h2>
        <button onClick={handleSignOut}>Sign Out</button>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <h2>{isLogin ? 'Login' : 'Sign Up'}</h2>
      {error && <p className="error">{error}</p>}
      
      <form onSubmit={handleAuth}>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>
        
        <div>
          <label htmlFor="password">Password:</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>

        <button type="submit">
          {isLogin ? 'Login' : 'Sign Up'}
        </button>
      </form>

      <button 
        onClick={() => setIsLogin(!isLogin)}
        className="toggle-auth"
      >
        {isLogin ? 'Need an account? Sign Up' : 'Already have an account? Login'}
      </button>
    </div>
  );
};

export default Auth; 