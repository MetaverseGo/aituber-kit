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

# AI Tuber Kit - Deployment Optimization

## Build Size Optimization

To meet AWS Amplify's 230MB build size limit, several optimizations have been implemented:

### Asset Management

- Large VRM models moved to `assets_backup/` directory (excluded from deployment)
- Only essential avatar model (`nikechan_v2.vrm`) kept for production
- Live2D assets moved to backup to reduce size

### Canvas Package Optimization

The `canvas` npm package (~100MB+) has been conditionally removed from production builds to reduce deployment size:

#### Changes Made:

1. **Conditional Import**: `src/pages/api/convertSlide.ts` now imports canvas conditionally
2. **Graceful Degradation**: PDF slide conversion will show a user-friendly error when canvas is unavailable
3. **Amplify Configuration**: `amplify.yml` removes the canvas package after build

#### Impact:

- **Reduced build size**: ~100MB reduction
- **Feature availability**: PDF slide conversion feature will be disabled in production
- **User experience**: Clear error messages when attempting to use unavailable features

#### Local Development:

- All features work normally in local development
- Canvas package remains available for `npm run dev`

### File Exclusions

- Build cache and logs excluded via `.gitignore`
- Documentation and backup assets excluded from deployment

## Current Build Size

- Local measurement: ~78MB
- Amplify deployment: Should be under 230MB limit

## Deployment Configuration

See `amplify.yml` for build configuration and `next.config.js` for optimization settings.
Add NEXT*PUBLIC* to Amplify Environment Variables settings
