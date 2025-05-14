import { useState, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import { collection, addDoc, getDocs, query, orderBy, deleteDoc, doc, where, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase/config';
import * as XLSX from 'xlsx';
import './UploadPage.css';

type Device = {
  id: string;
  name: string;
  uploadedAt: string;
  sessionId: string;
};

type UploadSession = {
  id: string;
  timestamp: string;
  deviceCount: number;
  devices: Device[];
};

type MatchedData = {
  matched: Device[];
  unmatched: string[];
};

type LoadingState = {
  isUploading: boolean;
  isMatching: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  isDownloading: boolean;
};

type OperationStatus = {
  deleted: boolean;
  saved: boolean;
  downloaded: boolean;
};

type PaginationState = {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  lastDoc: any;
};

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState<LoadingState>({
    isUploading: false,
    isMatching: false,
    isDeleting: false,
    isSaving: false,
    isDownloading: false
  });
  const [uploadSessions, setUploadSessions] = useState<UploadSession[]>([]);
  const [totalDevices, setTotalDevices] = useState<number>(0);
  const [matchedData, setMatchedData] = useState<MatchedData | null>(null);
  const [operationStatus, setOperationStatus] = useState<OperationStatus>({
    deleted: false,
    saved: false,
    downloaded: false
  });
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 15,
    totalItems: 0,
    lastDoc: null
  });
  const [matchedPagination, setMatchedPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 15,
    totalItems: 0,
    lastDoc: null
  });

  const fetchDevices = async (isInitial = true) => {
    try {
      const devicesCollection = collection(db, 'devices');
      
      // Get total count
      const countSnapshot = await getCountFromServer(devicesCollection);
      const totalCount = countSnapshot.data().count;

      // Build query
      let q = query(
        devicesCollection,
        orderBy('uploadedAt', 'desc'),
        limit(pagination.itemsPerPage)
      );

      // If not initial load and we have a last document, start after it
      if (!isInitial && pagination.lastDoc) {
        q = query(
          devicesCollection,
          orderBy('uploadedAt', 'desc'),
          startAfter(pagination.lastDoc),
          limit(pagination.itemsPerPage)
        );
      }

      const querySnapshot = await getDocs(q);
      
      const devicesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name,
        uploadedAt: doc.data().uploadedAt,
        sessionId: doc.data().sessionId
      }));

      // Group devices by session
      const sessions = devicesData.reduce((acc: { [key: string]: Device[] }, device) => {
        if (!acc[device.sessionId]) {
          acc[device.sessionId] = [];
        }
        acc[device.sessionId].push(device);
        return acc;
      }, {});

      // Convert to array of sessions
      const sessionsArray = Object.entries(sessions).map(([id, devices]) => ({
        id,
        timestamp: devices[0].uploadedAt,
        deviceCount: devices.length,
        devices
      }));

      // Sort sessions by timestamp (newest first)
      sessionsArray.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setUploadSessions(sessionsArray);
      setTotalDevices(totalCount);
      
      // Update pagination state
      setPagination(prev => ({
        ...prev,
        totalItems: totalCount,
        lastDoc: querySnapshot.docs[querySnapshot.docs.length - 1]
      }));
    } catch (error) {
      console.error('Error fetching devices:', error);
      setMessage('Error fetching devices. Please try again.');
    }
  };

  useEffect(() => {
    fetchDevices(true);
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      setMessage('No file selected');
      return;
    }

    // Check file type
    const validTypes = ['.xlsx', '.xls'];
    const fileExtension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    
    if (!validTypes.includes(fileExtension)) {
      setMessage('Please upload a valid Excel file (.xlsx or .xls)');
      event.target.value = ''; // Clear the input
      setFile(null);
      return;
    }

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (selectedFile.size > maxSize) {
      setMessage('File size should be less than 5MB');
      event.target.value = ''; // Clear the input
      setFile(null);
      return;
    }

    // Set file immediately to prevent flickering
    setFile(selectedFile);
    setMessage('');

    // Validate file content
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Check if workbook has sheets
        if (workbook.SheetNames.length === 0) {
          setMessage('Excel file is empty');
          event.target.value = ''; // Clear the input
          setFile(null);
          return;
        }

        // Check if first sheet has data
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        
        if (jsonData.length <= 1) { // Only header row or empty
          setMessage('Excel file must contain data rows');
          event.target.value = ''; // Clear the input
          setFile(null);
          return;
        }

        // If all validations pass
        setMatchedData(null); // Clear any previous matched data
        setOperationStatus({ // Reset operation status
          deleted: false,
          saved: false,
          downloaded: false
        });
      } catch (error) {
        console.error('Error reading Excel file:', error);
        setMessage('Error reading Excel file. Please ensure it is a valid Excel file.');
        event.target.value = ''; // Clear the input
        setFile(null);
      }
    };

    reader.onerror = () => {
      setMessage('Error reading file. Please try again.');
      event.target.value = ''; // Clear the input
      setFile(null);
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file');
      return;
    }

    setLoading(prev => ({ ...prev, isUploading: true }));
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

          const sessionId = new Date().toISOString();
          const devicesCollection = collection(db, 'devices');
          const uploadedDevices: Device[] = [];
          
          for (const device of devices) {
            const docRef = await addDoc(devicesCollection, {
              name: device.name,
              uploadedAt: new Date().toISOString(),
              sessionId: sessionId
            });
            uploadedDevices.push({
              id: docRef.id,
              name: device.name,
              uploadedAt: new Date().toISOString(),
              sessionId: sessionId
            });
          }

          setMessage(`Successfully processed ${devices.length} devices!`);
          fetchDevices();
          // Don't clear the file here, let the user decide when to clear
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
      setLoading(prev => ({ ...prev, isUploading: false }));
    }
  };

  const handleMatchData = async () => {
    if (!file) {
      setMessage('Please select a file');
      return;
    }

    setLoading(prev => ({ ...prev, isMatching: true }));
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

          // Get all device names from the Excel file
          const newDevices = jsonData.slice(1)
            .map((row: any) => row[0]?.trim() || '')
            .filter((name: string) => name);

          // Fetch all existing devices
          const devicesCollection = collection(db, 'devices');
          const querySnapshot = await getDocs(devicesCollection);
          const existingDevices = querySnapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name,
            uploadedAt: doc.data().uploadedAt,
            sessionId: doc.data().sessionId
          }));

          const matched: Device[] = [];
          const unmatched: string[] = [];
          const processedExistingDevices = new Set<string>();

          // Group devices by name (case-insensitive)
          const existingDevicesByName = existingDevices.reduce((acc, device) => {
            const nameLower = device.name.toLowerCase();
            if (!acc[nameLower]) {
              acc[nameLower] = [];
            }
            acc[nameLower].push(device);
            return acc;
          }, {} as { [key: string]: Device[] });

          // Process each device in the uploaded file
          newDevices.forEach(deviceName => {
            const nameLower = deviceName.toLowerCase();
            const matchingDevices = existingDevicesByName[nameLower] || [];
            
            // Find the first unprocessed matching device
            const unprocessedMatch = matchingDevices.find(device => !processedExistingDevices.has(device.id));
            
            if (unprocessedMatch) {
              // Match found and not yet processed
              matched.push(unprocessedMatch);
              processedExistingDevices.add(unprocessedMatch.id);
            } else {
              // No unprocessed match found, add to unmatched
              unmatched.push(deviceName);
            }
          });

          setMatchedData({ matched, unmatched });
          setMessage(`Found ${matched.length} matches and ${unmatched.length} new devices`);
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
      setLoading(prev => ({ ...prev, isMatching: false }));
    }
  };

  const handleDeleteMatched = async () => {
    if (!matchedData) return;

    setLoading(prev => ({ ...prev, isDeleting: true }));
    try {
      for (const device of matchedData.matched) {
        await deleteDoc(doc(db, 'devices', device.id));
      }
      setMessage(`Successfully deleted ${matchedData.matched.length} matched devices`);
      setOperationStatus(prev => ({ ...prev, deleted: true }));
      fetchDevices();
    } catch (error) {
      console.error('Error deleting matched devices:', error);
      setMessage('Error deleting matched devices. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const handleSaveUnmatched = async () => {
    if (!matchedData) return;

    setLoading(prev => ({ ...prev, isSaving: true }));
    try {
      const sessionId = new Date().toISOString();
      const devicesCollection = collection(db, 'devices');
      
      for (const deviceName of matchedData.unmatched) {
        await addDoc(devicesCollection, {
          name: deviceName,
          uploadedAt: new Date().toISOString(),
          sessionId: sessionId
        });
      }

      setMessage(`Successfully saved ${matchedData.unmatched.length} new devices`);
      setOperationStatus(prev => ({ ...prev, saved: true }));
      fetchDevices();
    } catch (error) {
      console.error('Error saving unmatched devices:', error);
      setMessage('Error saving unmatched devices. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, isSaving: false }));
    }
  };

  const handleDownloadMatched = () => {
    if (!matchedData) return;

    setLoading(prev => ({ ...prev, isDownloading: true }));
    try {
      const worksheet = XLSX.utils.json_to_sheet(
        matchedData.matched.map(device => ({
          'Device Name': device.name,
          'Upload Date': formatDate(device.uploadedAt)
        }))
      );

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Matched Devices');
      XLSX.writeFile(workbook, 'matched_devices.xlsx');
      setMessage('Successfully downloaded matched devices');
      setOperationStatus(prev => ({ ...prev, downloaded: true }));
    } catch (error) {
      console.error('Error downloading matched devices:', error);
      setMessage('Error downloading matched devices. Please try again.');
    } finally {
      setLoading(prev => ({ ...prev, isDownloading: false }));
    }
  };

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > Math.ceil(pagination.totalItems / pagination.itemsPerPage)) {
      return;
    }
    setPagination(prev => ({ ...prev, currentPage: newPage }));
    await fetchDevices(false);
  };

  const handleMatchedPageChange = (newPage: number) => {
    if (!matchedData) return;
    const totalPages = Math.ceil(matchedData.matched.length / matchedPagination.itemsPerPage);
    if (newPage < 1 || newPage > totalPages) {
      return;
    }
    setMatchedPagination(prev => ({ ...prev, currentPage: newPage }));
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      await deleteDoc(doc(db, 'devices', deviceId));
      setMessage('Device deleted successfully');
      fetchDevices();
    } catch (error) {
      console.error('Error deleting device:', error);
      setMessage('Error deleting device. Please try again.');
    }
  };

  const handleClear = () => {
    setFile(null);
    setMatchedData(null);
    setMessage('');
    setOperationStatus({
      deleted: false,
      saved: false,
      downloaded: false
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderUploadSession = (session: UploadSession) => (
    <div className="upload-session" key={session.id}>
      <div className="session-header">
        <div className="session-info">
          <h3 className="session-title">Upload Session</h3>
          <div className="session-timestamp">{formatDate(session.timestamp)}</div>
        </div>
        <div className="session-count">
          {session.deviceCount} {session.deviceCount === 1 ? 'Device' : 'Devices'}
        </div>
      </div>
      <div className="devices-table-wrapper">
        <table className="devices-table">
          <thead>
            <tr>
              <th>Device Name</th>
              <th>Upload Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {session.devices.map((device) => (
              <tr key={device.id}>
                <td className="device-name">{device.name}</td>
                <td className="device-date">{formatDate(device.uploadedAt)}</td>
                <td className="device-actions">
                  <button
                    onClick={() => handleDeleteDevice(device.id)}
                    className="button button-danger"
                    aria-label={`Delete device ${device.name}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const LoadingSpinner = () => (
    <div className="loading-spinner-container">
      <svg className="loading-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  );

  const renderOperationStatus = () => {
    const allCompleted = operationStatus.deleted && operationStatus.saved && operationStatus.downloaded;
    
    return (
      <div className="operation-status">
        <div className="status-item">
          <span className={`status-icon ${operationStatus.deleted ? 'completed' : ''}`}>
            {operationStatus.deleted ? '✓' : '○'}
          </span>
          <span>Delete Matched</span>
        </div>
        <div className="status-item">
          <span className={`status-icon ${operationStatus.saved ? 'completed' : ''}`}>
            {operationStatus.saved ? '✓' : '○'}
          </span>
          <span>Save Unmatched</span>
        </div>
        <div className="status-item">
          <span className={`status-icon ${operationStatus.downloaded ? 'completed' : ''}`}>
            {operationStatus.downloaded ? '✓' : '○'}
          </span>
          <span>Download Matched</span>
        </div>
        {allCompleted && (
          <div className="all-completed">
            All operations completed! You can now clear the results.
          </div>
        )}
      </div>
    );
  };

  const renderPagination = (currentPage: number, totalItems: number, itemsPerPage: number, onPageChange: (page: number) => void) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 7;
    
    // Calculate range of pages to show
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Add first page and ellipsis if needed
    if (startPage > 1) {
      pages.push(1);
      if (startPage > 2) {
        pages.push('...');
      }
    }

    // Add visible pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add last page and ellipsis if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push('...');
      }
      pages.push(totalPages);
    }

    return (
      <div className="pagination-container">
        <div className="pagination-info">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} items
        </div>
        <div className="pagination">
          <button
            className="pagination-button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            aria-label="First page"
          >
            «
          </button>
          <button
            className="pagination-button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            ‹
          </button>
          {pages.map((page, index) => (
            page === '...' ? (
              <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
            ) : (
              <button
                key={page}
                className={`pagination-button ${page === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(page as number)}
                aria-label={`Page ${page}`}
                aria-current={page === currentPage ? 'page' : undefined}
              >
                {page}
              </button>
            )
          ))}
          <button
            className="pagination-button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            ›
          </button>
          <button
            className="pagination-button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            aria-label="Last page"
          >
            »
          </button>
        </div>
      </div>
    );
  };

  const renderMatchedData = () => {
    if (!matchedData) return null;

    const startIndex = (matchedPagination.currentPage - 1) * matchedPagination.itemsPerPage;
    const endIndex = startIndex + matchedPagination.itemsPerPage;
    
    const paginatedMatched = matchedData.matched.slice(startIndex, endIndex);
    const paginatedUnmatched = matchedData.unmatched.slice(startIndex, endIndex);

    return (
      <div className="matched-data-section">
        <div className="matched-data-header">
          <h3 className="section-title">Matched Data Results</h3>
          <div className="matched-data-actions">
            <button
              onClick={handleDownloadMatched}
              className="button button-secondary"
              disabled={matchedData.matched.length === 0 || Object.values(loading).some(Boolean) || operationStatus.downloaded}
            >
              {loading.isDownloading ? (
                <div className="flex items-center">
                  <LoadingSpinner />
                  Downloading...
                </div>
              ) : (
                'Download Matched'
              )}
            </button>
            <button
              onClick={handleDeleteMatched}
              className="button button-danger"
              disabled={matchedData.matched.length === 0 || Object.values(loading).some(Boolean) || operationStatus.deleted}
            >
              {loading.isDeleting ? (
                <div className="flex items-center">
                  <LoadingSpinner />
                  Deleting...
                </div>
              ) : (
                'Delete Matched'
              )}
            </button>
            <button
              onClick={handleSaveUnmatched}
              className="button button-primary"
              disabled={matchedData.unmatched.length === 0 || Object.values(loading).some(Boolean) || operationStatus.saved}
            >
              {loading.isSaving ? (
                <div className="flex items-center">
                  <LoadingSpinner />
                  Saving...
                </div>
              ) : (
                'Save Unmatched'
              )}
            </button>
          </div>
        </div>

        {renderOperationStatus()}

        <div className="matched-data-content">
          <div className="matched-section">
            <h4>Matched Devices ({matchedData.matched.length})</h4>
            <div className="devices-table-wrapper">
              <table className="devices-table">
                <thead>
                  <tr>
                    <th>Device Name</th>
                    <th>Upload Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMatched.map((device) => (
                    <tr key={device.id}>
                      <td className="device-name">{device.name}</td>
                      <td className="device-date">{formatDate(device.uploadedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(
              matchedPagination.currentPage,
              matchedData.matched.length,
              matchedPagination.itemsPerPage,
              handleMatchedPageChange
            )}
          </div>

          <div className="unmatched-section">
            <h4>Unmatched Devices ({matchedData.unmatched.length})</h4>
            <div className="devices-table-wrapper">
              <table className="devices-table">
                <thead>
                  <tr>
                    <th>Device Name</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUnmatched.map((name, index) => (
                    <tr key={index}>
                      <td className="device-name">{name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {renderPagination(
              matchedPagination.currentPage,
              matchedData.unmatched.length,
              matchedPagination.itemsPerPage,
              handleMatchedPageChange
            )}
          </div>
        </div>
      </div>
    );
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
                    disabled={Object.values(loading).some(Boolean)}
                    aria-label="Upload Excel file"
                  />
                </div>
                <div className="button-group">
                  <button
                    onClick={handleUpload}
                    className="button button-primary"
                    disabled={Object.values(loading).some(Boolean)}
                    aria-label="Process file"
                  >
                    {loading.isUploading ? (
                      <div className="flex items-center">
                        <LoadingSpinner />
                        Processing...
                      </div>
                    ) : (
                      'Process File'
                    )}
                  </button>
                  <button
                    onClick={handleMatchData}
                    className="button button-secondary"
                    disabled={Object.values(loading).some(Boolean)}
                    aria-label="Match data"
                  >
                    {loading.isMatching ? (
                      <div className="flex items-center">
                        <LoadingSpinner />
                        Matching...
                      </div>
                    ) : (
                      'Match Data'
                    )}
                  </button>
                  <button
                    onClick={handleClear}
                    className="button button-secondary"
                    disabled={Object.values(loading).some(Boolean)}
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

            {matchedData && renderMatchedData()}

            <div className="upload-sessions">
              {uploadSessions.map((session) => renderUploadSession(session))}
              {renderPagination(
                pagination.currentPage,
                pagination.totalItems,
                pagination.itemsPerPage,
                handlePageChange
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 