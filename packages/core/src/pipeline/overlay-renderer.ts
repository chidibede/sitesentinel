/**
 * Image overlay renderer for hazard detection results
 *
 * Draws labeled bounding boxes on images using sharp
 */

import sharp from 'sharp';
import type { HazardFinding } from './hazard-detection.js';
import type { BoundingBox } from '../models/meta-model-api.js';

export interface OverlayOptions {
  showLabels?: boolean;
  boxColor?: string;
  textColor?: string;
  lineWidth?: number;
}

/**
 * Draw hazard findings overlay on image
 */
export async function renderOverlay(
  imageBuffer: Buffer,
  findings: HazardFinding[],
  options: OverlayOptions = {}
): Promise<Buffer> {
  const { showLabels = true, textColor = '#FFFFFF', lineWidth = 3 } = options;

  // Get image metadata
  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const { width = 0, height = 0 } = metadata;

  // Create SVG overlay with all boxes
  const svgElements: string[] = [];

  findings.forEach((finding, findingIndex) => {
    const color = getSeverityColor(finding.severity);

    finding.evidenceBoxes.forEach((box, boxIndex) => {
      // Draw rectangle
      svgElements.push(
        `<rect x="${box.x1}" y="${box.y1}" width="${box.x2 - box.x1}" height="${box.y2 - box.y1}" fill="none" stroke="${color}" stroke-width="${lineWidth}" />`
      );

      // Draw label if requested
      if (showLabels) {
        const label = `${findingIndex + 1}.${boxIndex + 1}: ${finding.title} (${finding.severity})`;
        const labelY = box.y1 > 30 ? box.y1 - 5 : box.y2 + 20;

        // Background for text
        svgElements.push(
          `<rect x="${box.x1}" y="${labelY - 18}" width="${Math.min(label.length * 8, width - box.x1)}" height="20" fill="${color}" fill-opacity="0.8" />`
        );

        // Text
        svgElements.push(
          `<text x="${box.x1 + 5}" y="${labelY}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${textColor}">${escapeXml(label)}</text>`
        );
      }
    });
  });

  const svg = `
    <svg width="${width}" height="${height}">
      ${svgElements.join('\n')}
    </svg>
  `;

  // Composite SVG onto image
  const result = await image
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  return result;
}

/**
 * Get color for severity level
 */
function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: '#FF0000', // Red
    high: '#FF6600', // Orange
    medium: '#FFCC00', // Yellow
    low: '#00FF00', // Green
  };

  return colors[severity] ?? '#FF0000';
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Render simple detection boxes (without findings)
 */
export async function renderDetectionBoxes(
  imageBuffer: Buffer,
  boxes: BoundingBox[],
  labels?: string[],
  options: OverlayOptions = {}
): Promise<Buffer> {
  const { boxColor = '#00FF00', lineWidth = 2 } = options;

  const image = sharp(imageBuffer);
  const metadata = await image.metadata();
  const { width = 0, height = 0 } = metadata;

  const svgElements: string[] = [];

  boxes.forEach((box, index) => {
    svgElements.push(
      `<rect x="${box.x1}" y="${box.y1}" width="${box.x2 - box.x1}" height="${box.y2 - box.y1}" fill="none" stroke="${boxColor}" stroke-width="${lineWidth}" />`
    );

    const label = labels?.[index];
    if (label) {
      const labelY = box.y1 > 30 ? box.y1 - 5 : box.y2 + 20;

      svgElements.push(
        `<rect x="${box.x1}" y="${labelY - 18}" width="${Math.min(label.length * 8, width - box.x1)}" height="20" fill="${boxColor}" fill-opacity="0.8" />`
      );

      svgElements.push(
        `<text x="${box.x1 + 5}" y="${labelY}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#FFFFFF">${escapeXml(label)}</text>`
      );
    }
  });

  const svg = `
    <svg width="${width}" height="${height}">
      ${svgElements.join('\n')}
    </svg>
  `;

  const result = await image
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();

  return result;
}
