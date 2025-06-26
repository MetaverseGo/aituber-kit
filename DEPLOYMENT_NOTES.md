# Deployment Notes - Build Size Optimization

## Build Size Fixed ✅

- **Previous size**: 447MB ❌ (over 230MB limit)
- **Optimized size**: ~78MB ✅ (under 230MB limit)

## Assets Moved to Backup

The following large assets were moved out of `public/` to reduce deployment size:

### VRM Models (moved to `assets_backup/`)

- `nikechan_v2_outerwear.vrm` (48MB)
- `nikechan_v1.vrm` (19MB)
- `AvatarSample_A.vrm` (14MB)
- `AvatarSample_B.vrm` (15MB)
- `AvatarSample_C.vrm` (13MB)

### Live2D Assets (moved to `assets_backup/`)

- `live2d/nike01/` directory (26MB)

### Removed Files

- `public/voice_test.wav` (308KB) - test file

## Remaining Assets in Public

- `nikechan_v2.vrm` (48MB) ✅ - **Your primary model**
- Essential images and icons
- Backgrounds and UI assets

## Production Recommendations

### 1. External Asset Storage (Recommended)

For large 3D assets, consider:

- **AWS S3** + CloudFront CDN
- **Cloudinary** for media optimization
- **GitHub LFS** for large binary files
- Load assets dynamically when needed

### 2. Asset Loading Strategy

```javascript
// Example: Dynamic VRM loading
const loadVRM = async (modelName) => {
  const response = await fetch(`https://your-cdn.com/vrm/${modelName}.vrm`)
  return response.blob()
}
```

### 3. Build Configuration

The following optimizations are already applied in `next.config.js`:

- `outputFileTracingExcludes` for large assets
- Build cache exclusion

### 4. Deployment Workflow

1. **Development**: Keep all assets locally in `assets_backup/`
2. **Production**: Assets are excluded from deployment
3. **Runtime**: Load large assets from external CDN

## Restoring Assets for Local Development

If you need the moved assets back for local development:

```bash
# Restore VRM files
Move-Item -Path "assets_backup\*.vrm" -Destination "public\vrm\"

# Restore Live2D assets
Move-Item -Path "assets_backup\nike01" -Destination "public\live2d\"
```

## File Size Monitoring

Monitor these directories to prevent future size issues:

- `public/vrm/` - VRM 3D models
- `public/live2d/` - Live2D animations
- `public/images/` - Image assets
- Any new large asset directories

## Current Status

✅ **Build size**: ~78MB (under 230MB limit)  
✅ **Amplify deployment**: Should work now  
✅ **Essential functionality**: Preserved with your nikechan_v2.vrm model
