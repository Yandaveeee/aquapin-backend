// File: mobile-app/src/api/chat.js

export const sendToAquaBot = async (userText, imageFile) => {
  const formData = new FormData();
  
  // 1. Add the text (Must match backend name 'message')
  formData.append("message", userText);
  
  // 2. Add the image (if it exists)
  if (imageFile) {
    formData.append("image", {
      uri: imageFile.uri,         
      name: imageFile.fileName || 'photo.jpg', // Crucial for Android/iOS
      type: imageFile.mimeType || 'image/jpeg', // Crucial for Android/iOS
    });
  }

  try {
    // Make sure this URL is your LIVE Render URL
    const response = await fetch("https://aquapin-backend-igvj.onrender.com/api/chat/", {
      method: "POST",
      body: formData,
      headers: {
        'Accept': 'application/json',
        // NEVER set 'Content-Type' manually for FormData!
      },
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Server Error:", errorText);
        return "The server had a problem processing that image.";
    }

    const data = await response.json();
    return data.response;
    
  } catch (error) {
    console.error("Connection Error:", error);
    return "I cannot reach the server. Please check your internet.";
  }
};