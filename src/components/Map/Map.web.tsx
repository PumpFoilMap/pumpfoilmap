import React, { useEffect, useRef } from 'react';
import maplibregl, { Popup } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { MapProps } from './types';
// @ts-ignore - JSON style import
import roadsCitiesStyle from '../../map-styles/roads-cities-style.json';

function ensureCss() {
  const id = 'maplibre-css';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css';
  document.head.appendChild(link);
}

export default function MapWeb({ points, onPickLocation, picking }: MapProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const loadedRef = useRef<boolean>(false);
  const pendingFCRef = useRef<any | null>(null);
  // Keep latest props in refs for stable event handlers
  const pickRef = useRef<boolean>(!!picking);
  const cbRef = useRef<typeof onPickLocation | undefined>(onPickLocation);
  useEffect(() => {
    pickRef.current = !!picking;
    cbRef.current = onPickLocation;
  }, [picking, onPickLocation]);
  // minimal mode removed; always single style

  // Lightweight test helpers (fallback if map style never loads in CI)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV === 'production') return;
    const g: any = window as any;
    if (!g.PFM_TEST) {
      g.PFM_TEST = {};
    }
    if (!g.PFM_TEST.openSpot) {
      g.PFM_TEST.openSpot = (lon: number, lat: number) => {
        // Find nearest point in provided dataset
        const match = points.reduce<{p:any; d:number}|null>((acc, p) => {
          const d = Math.hypot(p.lon - lon, p.lat - lat);
            if (!acc || d < acc.d) return { p, d };
          return acc;
        }, null);
        if (!match || match.d > 0.2) return; // threshold ~ 10-20km
        // Create / replace popup DOM manually (simplified)
        const root = containerRef.current || document.body;
        let popEl = root.querySelector('[data-testid="spot-popup"]');
        if (popEl) popEl.remove();
        popEl = document.createElement('div');
  popEl.setAttribute('data-testid', 'spot-popup');
        const pop = popEl as HTMLElement;
        pop.style.position = 'absolute';
        pop.style.top = '16px';
        pop.style.left = '16px';
        pop.style.background = 'rgba(255,255,255,0.95)';
        pop.style.padding = '8px 10px';
        pop.style.borderRadius = '6px';
        pop.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
        // Optional image (associations only) in a square box
        const assocImage = (match.p.type === 'association' && match.p.imageUrl)
          ? `<div style=\"margin-top:8px;width:240px;height:240px;max-width:240px;max-height:240px;overflow:hidden;border-radius:6px\"><img src=\"${match.p.imageUrl}\" alt=\"image association\" style=\"width:100%;height:100%;object-fit:cover;display:block\" /></div>`
          : '';
  const hasImg = Boolean(assocImage);
  popEl.setAttribute('data-type', String(match.p.type ?? ''));
  popEl.setAttribute('data-has-img', hasImg ? '1' : '0');
        pop.innerHTML = `<div data-type=\"${match.p.type ?? ''}\" data-has-img=\"${hasImg ? '1' : '0'}\">` +
          `<div style=\"font-weight:600;margin-bottom:4px\">${match.p.title || 'Spot'}</div>` +
          (match.p.description ? `<div style=\"color:#555\">${match.p.description}</div>` : '') +
          (match.p.type === 'association' && match.p.imageUrl
            ? `<div style=\"margin-top:8px;width:240px;height:240px;max-width:240px;max-height:240px;overflow:hidden;border-radius:6px\"><img data-testid=\"spot-image\" src=\"${match.p.imageUrl}\" alt=\"image association\" style=\"width:100%;height:100%;object-fit:cover;display:block\" /></div>`
            : '') +
          (match.p.type === 'association' && match.p.url ? `<div style=\"margin-top:6px\"><a style=\"color:#0a62c9;text-decoration:none;font-weight:500\" href=\"${match.p.url}\" target=\"_blank\" rel=\"noopener\">Visiter le site ↗</a></div>` : '') +
          `<div style=\"margin-top:6px;color:#777;font-size:12px\">${match.p.lat.toFixed(4)}, ${match.p.lon.toFixed(4)}</div>` +
          `</div>`;
        root.appendChild(pop);
      };
    }
    // Always use latest callback via ref
    g.PFM_TEST.pickAt = (lon: number, lat: number) => {
      if (cbRef.current) cbRef.current({ lon, lat });
    };
  }, [points]);

  function toFeatureCollection(pts: MapProps['points']) {
    const features = pts.map((p, i) => ({
      type: 'Feature' as const,
      id: i,
      properties: {
        weight: p.weight ?? 1,
        title: p.title ?? `Spot #${i + 1}`,
        description: p.description ?? '',
        type: p.type,
        url: p.url,
        imageUrl: p.imageUrl,
        address: p.address,
        submittedBy: p.submittedBy,
        createdAt: p.createdAt
      },
      geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] }
    }));
    return { type: 'FeatureCollection' as const, features };
  }

  useEffect(() => {
    if (!containerRef.current) return;
    ensureCss();
    if (!mapRef.current) {
      const key = (process.env.EXPO_PUBLIC_MAPTILER_KEY || process.env.MAPTILER_KEY || '').trim();
      let styleObj: any = roadsCitiesStyle;
      if (key) {
        styleObj = JSON.parse(JSON.stringify(roadsCitiesStyle).replace(/\{\{MAPTILER_KEY\}\}/g, key));
      } else {
        styleObj = JSON.parse(JSON.stringify(roadsCitiesStyle).replace(/\?key=\{\{MAPTILER_KEY\}\}/g, ''));
      }
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: styleObj,
        center: [2.21, 46.22],
        zoom: 5
      });
      mapRef.current = map;
  map.on('load', () => {
        loadedRef.current = true;
        const initial = pendingFCRef.current ?? toFeatureCollection(points);
        // Try to find the first symbol (label) layer to keep labels above our overlays
        const style = map.getStyle();
        const firstSymbolLayerId = style && style.layers ? (style.layers.find((l: any) => l.type === 'symbol')?.id as string | undefined) : undefined;
        if (!map.getSource('spots')) {
          map.addSource('spots', {
            type: 'geojson',
            data: initial,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50
          });
        }

        // World cities (optional): scaled black dots
        // world cities overlay removed

        // Clustered circles
        if (!map.getLayer('clusters')) {
          map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'spots',
            filter: ['has', 'point_count'],
            paint: {
              'circle-color': [
                'step', ['get', 'point_count'],
                '#9ed8ff', 20,
                '#55b2ff', 50,
                '#2282e0'
              ],
              'circle-radius': [
                'step', ['get', 'point_count'],
                18, 20, 24, 50, 30
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff'
            }
          }, firstSymbolLayerId);
        }

        // Cluster count labels
        if (!map.getLayer('cluster-count')) {
          map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'spots',
            filter: ['has', 'point_count'],
            layout: {
              'text-field': ['get', 'point_count'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 12
            },
            paint: {
              'text-color': '#0a3b6b'
            }
          }, firstSymbolLayerId);
        }

        // Unclustered single points
        // Enhanced multi-ring spot styling: glow -> halo -> core
        if (!map.getLayer('unclustered-glow')) {
          map.addLayer({
            id: 'unclustered-glow',
            type: 'circle',
            source: 'spots',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                2, 12,
                6, 18,
                10, 26
              ],
              'circle-color': [
                'case',
                ['==', ['get', 'type'], 'ponton'], '#ff6b6b',
                ['==', ['get', 'type'], 'association'], '#2ecc71',
                '#1e90ff'
              ],
              'circle-opacity': 0.30,
              'circle-blur': 0.8
            }
          }, firstSymbolLayerId);
        }
        if (!map.getLayer('unclustered-halo')) {
          map.addLayer({
            id: 'unclustered-halo',
            type: 'circle',
            source: 'spots',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                2, 9,
                6, 13,
                10, 18
              ],
              'circle-color': '#ffffff'
            }
          }, firstSymbolLayerId);
        }
        if (!map.getLayer('unclustered-core')) {
          map.addLayer({
            id: 'unclustered-core',
            type: 'circle',
            source: 'spots',
            filter: ['!', ['has', 'point_count']],
            paint: {
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                2, 5.5,
                6, 7.5,
                10, 10
              ],
              'circle-color': [
                'case',
                ['==', ['get', 'type'], 'ponton'], '#ff3b3b',
                ['==', ['get', 'type'], 'association'], '#1e9e55',
                '#144c9e'
              ],
              'circle-stroke-width': 1.6,
              'circle-stroke-color': '#0f0f0f'
            }
          }, firstSymbolLayerId);
        }

        if (!map.getLayer('unclustered-title')) {
          map.addLayer({
            id: 'unclustered-title',
            type: 'symbol',
            source: 'spots',
            filter: ['!', ['has', 'point_count']],
            layout: {
              'text-field': ['get', 'title'],
              'text-font': ['Noto Sans Regular'],
              'text-size': 11,
              'text-offset': [0, 1.4],
              'text-anchor': 'top',
              'text-optional': true,
              'text-max-width': 10
            },
            paint: {
              'text-color': '#1a1a1a',
              'text-halo-color': '#ffffff',
              'text-halo-width': 0.9
            }
          }, firstSymbolLayerId);
        }

        // Click handler: clusters -> zoom in, points -> popup
        map.on('click', 'clusters', (e) => {
          const feature = e.features && e.features[0];
          if (!feature) return;
          const clusterId = (feature.properties as any).cluster_id;
          const source: any = map.getSource('spots');
          if (source && source.getClusterExpansionZoom) {
            source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
              if (err) return;
              const coordinates = (feature.geometry as any).coordinates.slice();
              map.easeTo({ center: coordinates as any, zoom });
            });
          }
        });

        const onPointClick = (e: any) => {
          const feature = e.features && e.features[0];
          if (!feature) return;
          if (pickRef.current && cbRef.current) {
            const coords = (feature.geometry as any).coordinates.slice();
            cbRef.current({ lon: coords[0], lat: coords[1] });
            return;
          }
          const coordinates = (feature.geometry as any).coordinates.slice();
          const props: any = feature.properties || {};
          // Derive nearest source point to enrich properties when style drops them
          let nearest: { p: any; d: number } | null = null;
          try {
            const [lon, lat] = coordinates as [number, number];
            nearest = points.reduce<{ p: any; d: number } | null>((acc, p) => {
              const d = Math.hypot((p.lon ?? 0) - lon, (p.lat ?? 0) - lat);
              if (!acc || d < acc.d) return { p, d };
              return acc;
            }, null);
          } catch {}
          const nearOk = Boolean(nearest && nearest.d < 0.0005);
          const isAssoc = props.type === 'association' || (nearOk && nearest!.p.type === 'association');
          // Derive imageUrl more robustly: fall back to original points lookup if missing
          const derivedImageUrl: string | undefined = (props.imageUrl as any) ?? (nearOk ? nearest!.p.imageUrl : undefined);
          const urlHtml = isAssoc && props.url
            ? `<div style=\"margin-top:8px\"><a style=\"color:#0a62c9;text-decoration:none;font-weight:500\" href=\"${props.url}\" target=\"_blank\" rel=\"noopener noreferrer\">Visiter le site ↗</a></div>`
            : '';
          const imageHtml = (isAssoc && derivedImageUrl)
            ? `<div style=\"margin-top:8px;width:240px;height:240px;max-width:240px;max-height:240px;overflow:hidden;border-radius:6px\"><img data-testid=\"spot-image\" src=\"${derivedImageUrl}\" alt=\"image association\" style=\"width:100%;height:100%;object-fit:cover;display:block\" /></div>`
            : '';
          const navUrl = props.type === 'ponton' ? `https://www.google.com/maps/dir/?api=1&destination=${coordinates[1]},${coordinates[0]}` : '';
          const navHtml = navUrl ? `<div style=\"margin-top:8px\"><a style=\"color:#0a62c9;text-decoration:none;font-weight:500\" href=\"${navUrl}\" target=\"_blank\" rel=\"noopener noreferrer\">Y aller ↗</a></div>` : '';
            const pontonFields = props.type === 'ponton'
              ? `<div style=\"margin-top:6px;color:#444\">Hauteur: ${props.heightCm ?? '-'} cm — Longueur: ${props.lengthM ?? '-'} m</div>
                 <div style=\"margin-top:2px;color:#444\">Accès: ${props.access ?? '-'}</div>`
              : '';
            const addressHtml = props.address ? `<div style=\"margin-top:6px;color:#444\">${props.address}</div>` : '';
          const metaHtml = `<div style=\"margin-top:6px;color:#777;font-size:12px\">${coordinates[1].toFixed(4)}, ${coordinates[0].toFixed(4)}</div>`;
          const submittedHtml = props.submittedBy ? `<div style=\"margin-top:4px;color:#777;font-size:12px\">par ${props.submittedBy}${props.createdAt ? ` — ${new Date(props.createdAt).toLocaleDateString()}` : ''}</div>` : '';
            const hasImg = Boolean(imageHtml);
            const html = `<div data-testid=\"spot-popup\" data-type=\"${isAssoc ? 'association' : (props.type ?? '')}\" data-has-img=\"${hasImg ? '1' : '0'}\" style=\"max-width:260px\">\n            <div style=\"font-weight:600;margin-bottom:4px\">${props.title || 'Spot'}</div>\n            ${props.description ? `<div style=\"color:#555\">${props.description}</div>` : ''}\n            ${pontonFields}\n            ${addressHtml}\n            ${imageHtml}\n            ${urlHtml}\n            ${navHtml}\n            ${metaHtml}\n            ${submittedHtml}\n          </div>`;
          new Popup({ closeButton: true })
            .setLngLat(coordinates as any)
            .setHTML(html)
            .addTo(map);
        };
        // Register clicks on all visual single-point layers (the original code only had a non-existent 'unclustered-point')
        ['unclustered-core', 'unclustered-halo', 'unclustered-glow', 'unclustered-title'].forEach((layerId) => {
          if (map.getLayer(layerId)) {
            map.on('click', layerId, onPointClick);
          }
        });
        if (pickRef.current && cbRef.current) {
          map.getCanvas().style.cursor = 'crosshair';
          map.on('click', (e) => {
            if (!pickRef.current) return; // runtime check
            cbRef.current?.({ lon: e.lngLat.lng, lat: e.lngLat.lat });
          });
        }
        // Expose lightweight test utilities in non-production for Playwright (no side effects in prod bundle tree-shaken)
        if (process.env.NODE_ENV !== 'production') {
          (containerRef.current as any).__mapInstance = map;
          (window as any).PFM_TEST = {
            openSpot(lon: number, lat: number) {
              try {
                const pt = map.project([lon, lat]);
                const features = map.queryRenderedFeatures(pt, { layers: ['unclustered-core'] });
                if (features.length) {
                  onPointClick({ features });
                }
              } catch {}
            },
            pickAt(lon: number, lat: number) {
              const fake = { lngLat: { lng: lon, lat }, point: map.project([lon, lat]) } as any;
              if (picking && onPickLocation) {
                onPickLocation({ lon, lat });
              }
              return fake;
            }
          };
        }
        // If future updates were queued before load, apply latest now
        const latest = pendingFCRef.current;
        if (latest) {
          const src = map.getSource('spots') as any;
          if (src?.setData) src.setData(latest);
          pendingFCRef.current = null;
        }
      });
    }

    // no style switching logic needed
    return () => {
      // keep instance
    };
  }, []);

  // Update data when points change
  useEffect(() => {
    const map = mapRef.current;
  // still update spots even in minimal mode
    const fc = toFeatureCollection(points);
    if (map && loadedRef.current && map.getSource('spots')) {
      const src = map.getSource('spots') as any;
      if (src?.setData) src.setData(fc);
    } else {
      // queue until style is loaded
      pendingFCRef.current = fc;
    }
  }, [points]);

  // world cities overlay removed

  return <div ref={containerRef} data-testid="map-container" style={{ flex: 1, minHeight: 400 }} />;
}
