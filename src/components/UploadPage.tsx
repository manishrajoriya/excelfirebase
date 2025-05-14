import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import * as XLSX from 'xlsx';
import './UploadPage.css';

type Device = {
  id: string;
  name: string;
  uploadedAt: string;
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [totalDevices, setTotalDevices] = useState<number>(0);

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
        setMessage('');
      } else {
        setMessage('Please upload a valid Excel file (.xlsx or .xls)');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file');
      return;
    }

    setIsUploading(true);
    setMessage('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          const devices = jsonData.slice(1).map((row: any) => ({
            name: row[0]?.trim() || ''
          })).filter((device: any) => device.name);

          const devicesCollection = collection(db, 'devices');
          for (const device of devices) {
            await addDoc(devicesCollection, {
              name: device.name,
              uploadedAt: new Date().toISOString()
            });
          }

          setMessage(`Successfully processed ${devices.length} devices!`);
          fetchDevices();
          setFile(null);
        } catch (error) {
          console.error('Error processing Excel file:', error);
          setMessage('Error processing Excel file. Please try again.');
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error processing file:', error);
      setMessage('Error processing file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const devicesCollection = collection(db, 'devices');
      const q = query(devicesCollection, orderBy('uploadedAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const devicesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        uploadedAt: doc.data().uploadedAt
      }));
      
      setDevices(devicesData);
      setTotalDevices(devicesData.length);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setMessage('Error fetching devices. Please try again.');
    }
  };

  const handleClear = () => {
    setFile(null);
    setDevices([]);
    setMessage('');
    setTotalDevices(0);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="upload-container">
      <div className="upload-wrapper">
        <div className="upload-card">
          <div className="upload-content">
            <div className="upload-header">
              <h2 className="upload-title">Excel Data Processor</h2>
              <p className="upload-subtitle">Upload and process your Excel files with ease</p>
            </div>

            <div className="upload-section">
              <div className="upload-section-header">
                <h3 className="section-title">Upload Excel File</h3>
                <div className="device-count">
                  Total Devices: {totalDevices}
                </div>
              </div>

              <div className="upload-controls">
                <div className="file-input-wrapper">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    className="file-input"
                    disabled={isUploading}
                    aria-label="Upload Excel file"
                  />
                </div>
                <div className="button-group">
                  <button
                    onClick={handleUpload}
                    className="button button-primary"
                    disabled={isUploading}
                    aria-label="Process file"
                  >
                    {isUploading ? (
                      <div className="flex items-center">
                        <svg className="loading-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </div>
                    ) : (
                      'Process File'
                    )}
                  </button>
                  <button
                    onClick={handleClear}
                    className="button button-secondary"
                    aria-label="Clear file and data"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {message && (
                <div className={`message ${message.includes('Successfully') ? 'message-success' : 'message-error'}`}>
                  {message}
                </div>
              )}
            </div>

            {devices.length > 0 && (
              <div className="devices-section">
                <h3 className="section-title">Processed Devices</h3>
                <div className="devices-table-wrapper">
                  <table className="devices-table">
                    <thead>
                      <tr>
                        <th>Device Name</th>
                        <th>Upload Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((device) => (
                        <tr key={device.id}>
                          <td className="device-name">{device.name}</td>
                          <td className="device-date">{formatDate(device.uploadedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 