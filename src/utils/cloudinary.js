// src/utils/cloudinary.js
// Free Cloudinary account: https://cloudinary.com
// Free tier: 25GB storage, 25GB bandwidth/month — plenty for a university pilot
//
// Setup:
//   1. Sign up at https://cloudinary.com (free)
//   2. Dashboard → Copy "Cloud name"
//   3. Settings → Upload → Add upload preset → set to "Unsigned" → save
//   4. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env.local

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Upload an image file to Cloudinary.
 * Returns the secure HTTPS URL of the uploaded image.
 * @param {File} file - The image file to upload
 * @param {string} folder - Cloudinary folder name (e.g. 'avatars', 'posts')
 * @returns {Promise<string>} - Secure image URL
 */
export const uploadImage = async (file, folder = 'uniconnect') => {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your .env.local file.'
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be under 5MB');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || 'Image upload failed');
  }

  const data = await res.json();
  return data.secure_url;
};
