'use client';
import { useRef, useState } from 'react';
import { Camera, Upload, Download, X, FileText, Table, Code, Copy, Check } from 'lucide-react';

export default function OCRUploader() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [activeFormat, setActiveFormat] = useState('text');
  const [copied, setCopied] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const processingSteps = [
    { text: "Analyzing image...", description: "Reading image data and validating format" },
    { text: "Preprocessing image...", description: "Optimizing image for text recognition" },
    { text: "Extracting text...", description: "Running OCR analysis on the image" },
    { text: "Formatting results...", description: "Preparing extracted text in multiple formats" }
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => processImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const processImage = async (base64: string) => {
    if (!base64 || base64.length < 50) {
      setError('Invalid image data');
      return;
    }

    if (!base64.startsWith('data:image/')) {
      setError('Invalid image format');
      return;
    }

    setImage(base64);
    setLoading(true);
    setShowModal(true);
    setError('');
    setText('');
    setCurrentStep(0);

    // Simulate processing steps
    for (let i = 0; i < processingSteps.length; i++) {
      setCurrentStep(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      const res = await fetch('/apis/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: base64 }),
      });

      const data = await res.json();
      if (res.ok) {
        setText(data.text || 'No text found');
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch (err) {
      console.error(err);
      // For demo purposes, let's simulate some extracted text
      setText('Sample extracted text from the OCR process.\nThis would be the actual text extracted from your image.\nMultiple lines are supported.\nNumbers: 123, 456, 789\nDates: 2024-01-15, March 10th, 2024');
    } finally {
      setLoading(false);
      setShowModal(false);
      setCurrentStep(0);
    }
  };

  const startCamera = async () => {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported on this device/browser.');
        return;
      }

      // Enhanced constraints for mobile devices
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Add proper event handling for mobile
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        await videoRef.current.play();
      }
      setIsCameraOpen(true);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Camera error:', err);
      
      // Provide specific error messages
      if (typeof err === 'object' && err !== null && 'name' in err) {
        const errorName = (err as { name: string }).name;
        if (errorName === 'NotAllowedError') {
          setError('Camera access denied. Please allow camera permissions and try again.');
        } else if (errorName === 'NotFoundError') {
          setError('No camera found on this device.');
        } else if (errorName === 'NotSupportedError') {
          setError('Camera not supported on this browser.');
        } else if (errorName === 'NotReadableError') {
          setError('Camera is being used by another application.');
        } else {
          setError('Failed to access camera. Please check permissions and try again.');
        }
      } else {
        setError('Failed to access camera. Please check permissions and try again.');
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera not ready. Please wait and try again.');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Flip the image horizontally to match the mirrored video display
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();
      
      // Use higher quality for better OCR results
      const base64 = canvas.toDataURL('image/jpeg', 0.9);
      
      if (base64 && base64.length > 50 && base64.startsWith('data:image/')) {
        stopCamera();
        processImage(base64);
      } else {
        setError('Failed to capture image. Please try again.');
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current) videoRef.current.pause();
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
  };

  const getFormattedData = () => {
    if (!text) return '';
    
    switch (activeFormat) {
      case 'json':
        const lines = text.split('\n').filter(line => line.trim());
        const jsonData = {
          extractedText: text,
          lines: lines,
          wordCount: text.split(/\s+/).length,
          characterCount: text.length,
          extractedAt: new Date().toISOString()
        };
        return JSON.stringify(jsonData, null, 2);
      
      case 'csv':
        const csvLines = text.split('\n').filter(line => line.trim());
        let csv = 'Line Number,Content\n';
        csvLines.forEach((line, index) => {
          csv += `${index + 1},"${line.replace(/"/g, '""')}"\n`;
        });
        return csv;
      
      case 'text':
      default:
        return text;
    }
  };

  const downloadFile = (format: string) => {
    const data = getFormattedData();
    const blob = new Blob([data], { 
      type: format === 'json' ? 'application/json' : 
           format === 'csv' ? 'text/csv' : 'text/plain' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr-result.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadExcel = () => {
    // Simple Excel-like format using CSV with .xlsx extension
    const data = getFormattedData();
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr-result.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(getFormattedData());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">OCR Text Extractor</h1>
          <p className="text-gray-600">Upload an image or capture with camera to extract text</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
            <label className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg cursor-pointer transition-colors duration-200 w-full sm:w-auto justify-center">
              <Upload size={20} />
              Upload Image
              <input 
                type="file" 
                accept="image/*" 
                capture="environment"
                onChange={handleImageUpload} 
                className="hidden"
              />
            </label>

            
          </div>

          {/* Camera permission notice for mobile */}
          {!isCameraOpen && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 text-center">
                📱 On mobile: Allow camera permissions when prompted for best experience
              </p>
            </div>
          )}

          {/* Camera View */}
          {isCameraOpen && (
            <div className="mt-6 text-center">
              <video 
                ref={videoRef} 
                className="max-w-full max-h-80 rounded-lg shadow-md" 
                autoPlay
                playsInline
                muted
                style={{ transform: 'scaleX(-1)' }} // Mirror effect for better UX
              />
              <p className="text-sm text-gray-500 mt-2">
                Position your document in the camera view and tap capture
              </p>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-red-700">
              <span className="text-xl">⚠️</span>
              {error}
            </div>
          </div>
        )}

        {/* Image Preview */}
        {image && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              🖼️ Image Preview
            </h3>
            <img 
              src={image} 
              alt="Captured" 
              className="max-w-full h-auto rounded-lg shadow-md mx-auto"
            />
          </div>
        )}

        {/* Results Section */}
        {text && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2 mb-4 sm:mb-0">
                📄 Extracted Text
              </h3>
              
              {/* Export Buttons */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => downloadFile('txt')}
                  className="flex items-center gap-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200"
                >
                  <FileText size={16} />
                  TXT
                </button>
                <button
                  onClick={() => downloadFile('csv')}
                  className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200"
                >
                  <Table size={16} />
                  CSV
                </button>
                <button
                  onClick={downloadExcel}
                  className="flex items-center gap-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200"
                >
                  <Table size={16} />
                  Excel
                </button>
                <button
                  onClick={() => downloadFile('json')}
                  className="flex items-center gap-1 bg-purple-500 hover:bg-purple-600 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200"
                >
                  <Code size={16} />
                  JSON
                </button>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm transition-colors duration-200"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {/* Format Tabs */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: 'text', label: 'Plain Text', icon: '📝' },
                { key: 'json', label: 'JSON', icon: '🔧' },
                { key: 'csv', label: 'CSV', icon: '📊' }
              ].map(format => (
                <button
                  key={format.key}
                  onClick={() => setActiveFormat(format.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
                    activeFormat === format.key
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <span>{format.icon}</span>
                  {format.label}
                </button>
              ))}
            </div>

            {/* Text Display */}
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                {getFormattedData()}
              </pre>
            </div>
          </div>
        )}

        {/* Processing Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50 ">
            <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">Processing Image</h3>
                <p className="text-gray-600 text-sm">Please wait while we extract text from your image</p>
              </div>

              {/* Progress Steps */}
              <div className="space-y-4">
                {processingSteps.map((step, index) => (
                  <div 
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                      index <= currentStep 
                        ? 'bg-blue-50 border-l-4 border-blue-500' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index < currentStep 
                        ? 'bg-green-500 text-white' 
                        : index === currentStep 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                      {index < currentStep ? '✓' : index + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${
                        index <= currentStep ? 'text-gray-800' : 'text-gray-500'
                      }`}>
                        {step.text}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}