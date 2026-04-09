import React, { useState } from 'react';
import { Upload, message } from 'antd';
import type { UploadProps } from 'antd';

interface AvatarUploadProps {
  value?: string;
  onChange?: (base64: string) => void;
  label?: string;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  value,
  onChange,
  label = '上传头像',
}) => {
  const [loading, setLoading] = useState(false);

  const getBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleChange: UploadProps['onChange'] = async (info) => {
    if (info.file.status === 'uploading') {
      setLoading(true);
      return;
    }

    if (info.file.status === 'done') {
      try {
        const base64 = await getBase64(info.file.originFileObj as File);
        onChange?.(base64);
        message.success('头像上传成功');
      } catch (error) {
        message.error('头像上传失败');
      } finally {
        setLoading(false);
      }
    }
  };

  const uploadButton = (
    <div className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-border rounded-full cursor-pointer hover:border-primary transition-colors duration-normal">
      <span className="text-2xl text-text-muted">+</span>
      <span className="text-xs text-text-muted mt-1">{label}</span>
    </div>
  );

  return (
    <Upload
      name="avatar"
      listType="picture-circle"
      showUploadList={false}
      accept="image/*"
      beforeUpload={() => false}
      onChange={handleChange}
      disabled={loading}
    >
      {value ? (
        <img
          src={value}
          alt="avatar"
          className="w-20 h-20 rounded-full object-cover"
        />
      ) : (
        uploadButton
      )}
    </Upload>
  );
};

export default AvatarUpload;
