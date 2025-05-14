import { useState } from 'react';
import { db } from '../firebase/config';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { auth } from '../firebase/config';
import './UserForm.css';

interface UserData {
  name: string;
  address: string;
  phone: string;
  email: string;
}

const UserForm = () => {
  const [formData, setFormData] = useState<UserData>({
    name: '',
    address: '',
    phone: '',
    email: ''
  });
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user logged in');
      }

      // Create or update user data in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        ...formData,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setMessage({ 
        text: 'Data saved successfully!', 
        type: 'success' 
      });

      // Clear form after successful submission
      setFormData({
        name: '',
        address: '',
        phone: '',
        email: ''
      });
    } catch (error: any) {
      setMessage({ 
        text: error.message || 'Error saving data', 
        type: 'error' 
      });
    }
  };

  return (
    <div className="user-form-container">
      <h2>User Information</h2>
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="user-form">
        <div className="form-group">
          <label htmlFor="name">Full Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your full name"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="address">Address</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Enter your address"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone Number</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="Enter your phone number"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Enter your email"
            required
          />
        </div>

        <button type="submit" className="submit-btn">
          Save Information
        </button>
      </form>
    </div>
  );
};

export default UserForm; 