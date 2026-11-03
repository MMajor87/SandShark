import type { TStreamQuality, TStreamQualityLayer } from '@sandshark/shared';

const getStreamQualityMetadataLabel = (
  quality: TStreamQuality,
  layers: TStreamQualityLayer[]
) => {
  if (quality.mode === 'auto') return 'auto';

  return layers.find((layer) => layer.spatialLayer === quality.spatialLayer)
    ?.label;
};

export { getStreamQualityMetadataLabel };
