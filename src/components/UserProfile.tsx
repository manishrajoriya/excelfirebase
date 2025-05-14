import { useState, useEffect } from 'react';
import { db, auth } from '../firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import './UserProfile.css';

interface UserData {
  name: string;
  address: string;
  phone: string;
  email: string;
  updatedAt: string;
}

const UserProfile = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('No user logged in');
        }

        const userRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          setUserData(docSnap.data() as UserData);
        } else {
          setError('No user data found');
        }
      } catch (err: any) {
        setError(err.message || 'Error fetching user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  if (loading) {
    return (
      <div className="user-profile-container">
        <div className="loading">Loading user data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="user-profile-container">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  if (!userData) {
    return (
      <div className="user-profile-container">
        <div className="no-data">No user data available. Please fill out the form.</div>
      </div>
    );
  }

  return (
    <div className="user-profile-container">
      <h2>User Profile</h2>
      <div className="profile-card">
        <div className="profile-field">
          <span className="field-label">Name:</span>
          <span className="field-value">{userData.name}</span>
        </div>
        <div className="profile-field">
          <span className="field-label">Address:</span>
          <span className="field-value">{userData.address}</span>
        </div>
        <div className="profile-field">
          <span className="field-label">Phone:</span>
          <span className="field-value">{userData.phone}</span>
        </div>
        <div className="profile-field">
          <span className="field-label">Email:</span>
          <span className="field-value">{userData.email}</span>
        </div>
        <div className="profile-field">
          <span className="field-label">Last Updated:</span>
          <span className="field-value">
            {new Date(userData.updatedAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default UserProfile; 