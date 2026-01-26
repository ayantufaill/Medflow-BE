# AWS S3 Configuration Guide

This guide explains how to configure AWS S3 for file uploads (e.g., practice logos) in the MedFlow application.

## Prerequisites

1. An AWS account
2. An S3 bucket created in your AWS account
3. AWS IAM user with S3 permissions

## Quick Setup

### Step 1: Create an S3 Bucket

1. Log in to [AWS Console](https://console.aws.amazon.com/)
2. Navigate to **S3** service
3. Click **Create bucket**
4. Enter a unique bucket name (e.g., `medflow-uploads`)
5. Choose a region (e.g., `us-west-2`)
6. **Important**: Uncheck "Block all public access" if you want public file access, OR keep it checked and use bucket policies
7. Click **Create bucket**

### Step 2: Create IAM User with S3 Permissions

1. Navigate to **IAM** service in AWS Console
2. Click **Users** → **Create user**
3. Enter a username (e.g., `medflow-s3-user`)
4. Select **Attach policies directly**
5. Search for and select **AmazonS3FullAccess** (or create a custom policy with only necessary permissions)
6. Click **Create user**
7. Click on the created user → **Security credentials** tab
8. Click **Create access key**
9. Select **Application running outside AWS**
10. Click **Create access key**
11. **IMPORTANT**: Copy both the **Access Key ID** and **Secret Access Key** immediately (you won't be able to see the secret key again)

### Step 3: Configure Bucket Permissions

#### Option A: Public Access (Using Bucket Policy - Recommended)

1. Go to your S3 bucket → **Permissions** tab
2. Scroll to **Bucket policy**
3. Click **Edit** and add this policy (replace `YOUR-BUCKET-NAME` with your bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

4. Click **Save changes**

#### Option B: Public Access (Using ACL - Legacy)

If your bucket supports ACLs (older buckets), you can enable ACLs:

1. Go to your S3 bucket → **Permissions** tab
2. Scroll to **Object Ownership**
3. Click **Edit** → Select **ACLs enabled**
4. In your `.env` file, set `AWS_S3_USE_ACL=true`

**Note**: Most modern S3 buckets have ACLs disabled by default. Use Option A (Bucket Policy) instead.

### Step 4: Configure Environment Variables

Add these variables to your backend `.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-west-2
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET_NAME=your-bucket-name

# Optional: Custom S3 base URL (if using CloudFront or custom domain)
# AWS_S3_BASE_URL=https://d1234567890.cloudfront.net

# Optional: Enable ACL (only if your bucket supports ACLs)
# AWS_S3_USE_ACL=false
```

### Step 5: Test the Configuration

1. Start your backend server
2. Try uploading a logo from the frontend
3. Check the server logs for any errors
4. If successful, verify the file appears in your S3 bucket

## Environment Variables Reference

| Variable                | Required | Description                                 | Example                                    |
| ----------------------- | -------- | ------------------------------------------- | ------------------------------------------ |
| `AWS_REGION`            | Yes      | AWS region where your bucket is located     | `us-west-2`                                |
| `AWS_ACCESS_KEY_ID`     | Yes      | IAM user access key ID                      | `AKIAIOSFODNN7EXAMPLE`                     |
| `AWS_SECRET_ACCESS_KEY` | Yes      | IAM user secret access key                  | `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
| `AWS_S3_BUCKET_NAME`    | Yes      | Name of your S3 bucket                      | `medflow-uploads`                          |
| `AWS_S3_BASE_URL`       | No       | Custom base URL (CloudFront, custom domain) | `https://cdn.example.com`                  |
| `AWS_S3_USE_ACL`        | No       | Enable ACL support (default: `false`)       | `true` or `false`                          |

## Common Issues and Solutions

### Error: "AWS_ACCESS_KEY_ID is not configured"

**Solution**: Make sure you've added `AWS_ACCESS_KEY_ID` to your `.env` file and restarted the server.

### Error: "Access denied to S3 bucket"

**Possible causes:**

- Invalid AWS credentials
- IAM user doesn't have S3 permissions
- Bucket policy is too restrictive

**Solution:**

1. Verify your access key ID and secret access key are correct
2. Check IAM user has `s3:PutObject` and `s3:DeleteObject` permissions
3. Review bucket policy if using one

### Error: "S3 bucket does not exist"

**Solution**:

1. Verify `AWS_S3_BUCKET_NAME` matches your bucket name exactly
2. Check `AWS_REGION` matches the bucket's region
3. Ensure the bucket exists in your AWS account

### Error: "Invalid AWS Access Key ID" or "SignatureDoesNotMatch"

**Solution**:

1. Regenerate access keys in IAM
2. Update both `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`
3. Restart the server

### Files upload but are not publicly accessible

**Solution**:

1. If using bucket policy (recommended): Ensure the bucket policy allows `s3:GetObject` for public access
2. If using ACL: Set `AWS_S3_USE_ACL=true` in `.env` and enable ACLs on the bucket
3. Check bucket's "Block public access" settings

## Security Best Practices

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use IAM roles** in production (instead of access keys) when running on AWS infrastructure
3. **Limit IAM permissions** - Only grant `s3:PutObject`, `s3:GetObject`, and `s3:DeleteObject` for the specific bucket
4. **Rotate access keys** regularly
5. **Use bucket policies** instead of ACLs for better security
6. **Enable versioning** on your bucket for backup/recovery
7. **Set up lifecycle policies** to automatically delete old files if needed

## Custom IAM Policy (Recommended)

Instead of using `AmazonS3FullAccess`, create a custom policy with minimal permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME"
    }
  ]
}
```

## Using CloudFront (Optional)

For better performance and custom domains:

1. Create a CloudFront distribution pointing to your S3 bucket
2. Set `AWS_S3_BASE_URL` to your CloudFront domain (e.g., `https://d1234567890.cloudfront.net`)
3. Files will be served through CloudFront instead of directly from S3

## Support

For issues with:

- **AWS S3**: [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- **IAM**: [AWS IAM Documentation](https://docs.aws.amazon.com/iam/)
- **CloudFront**: [AWS CloudFront Documentation](https://docs.aws.amazon.com/cloudfront/)
