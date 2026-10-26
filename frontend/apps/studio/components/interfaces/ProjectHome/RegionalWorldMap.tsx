import React, { useState } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps'
import GeographyData from '../Settings/Infrastructure/InfrastructureConfiguration/MapData.json'
import { AWS_REGIONS_COORDINATES } from '../Settings/Infrastructure/InfrastructureConfiguration/InstanceConfiguration.constants'

interface RegionalWorldMapProps {
  coordinates?: [number, number]
  label?: string
  regionCode?: string
}

const GLOBAL_REGIONS: Array<{ key: string; name: string; coordinates: [number, number]; flag?: string }> = [
  { key: 'SOUTHEAST_ASIA', name: 'Southeast Asia (Singapore)', coordinates: [103.8, 1.37], flag: '🇸🇬' },
  { key: 'SOUTH_ASIA', name: 'South Asia (Mumbai)', coordinates: [72.88, 19.08], flag: '🇮🇳' },
  { key: 'NORTHEAST_ASIA', name: 'Northeast Asia (Tokyo)', coordinates: [139.42, 35.41], flag: '🇯🇵' },
  { key: 'NORTHEAST_ASIA_2', name: 'Northeast Asia (Seoul)', coordinates: [126.98, 37.56], flag: '🇰🇷' },
  { key: 'OCEANIA', name: 'Oceania (Sydney)', coordinates: [151.2, -33.86], flag: '🇦🇺' },
  { key: 'CENTRAL_EU', name: 'Central Europe (Frankfurt)', coordinates: [8, 50], flag: '🇩🇪' },
  { key: 'WEST_EU', name: 'Western Europe (Ireland)', coordinates: [-8, 53], flag: '🇮🇪' },
  { key: 'WEST_EU_2', name: 'Western Europe (London)', coordinates: [-0.1, 51], flag: '🇬🇧' },
  { key: 'NORTH_EU', name: 'Northern Europe (Stockholm)', coordinates: [17.91, 59.65], flag: '🇸🇪' },
  { key: 'EAST_US', name: 'East US (North Virginia)', coordinates: [-78.45, 38.13], flag: '🇺🇸' },
  { key: 'EAST_US_2', name: 'East US (Ohio)', coordinates: [-83, 39.96], flag: '🇺🇸' },
  { key: 'WEST_US', name: 'West US (North California)', coordinates: [-121.96, 37.35], flag: '🇺🇸' },
  { key: 'WEST_US_2', name: 'West US (Oregon)', coordinates: [-122.67, 45.51], flag: '🇺🇸' },
  { key: 'CENTRAL_CANADA', name: 'Central Canada (Montreal)', coordinates: [-73.6, 45.5], flag: '🇨🇦' },
  { key: 'SOUTH_AMERICA', name: 'South America (São Paulo)', coordinates: [-46.38, -23.34], flag: '🇧🇷' },
]

export function RegionalWorldMap({
  coordinates = [103.8, 1.37],
  label = 'Southeast Asia (Singapore) · Dedicated VPS Host',
  regionCode = 'ap-southeast-1',
}: RegionalWorldMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<{
    name: string
    flag?: string
    isPrimary: boolean
  } | null>(null)

  return (
    <div className="w-full h-full relative flex flex-col items-center justify-center my-auto py-1 z-10 select-none">
      <div className="w-full h-[220px] max-h-[230px] overflow-hidden flex items-center justify-center">
        <ComposableMap
          projectionConfig={{ scale: 135, center: [14, 15] }}
          width={720}
          height={320}
          className="w-full h-full"
        >
          <ZoomableGroup
            center={[14, 15]}
            zoom={1.05}
            minZoom={1.0}
            maxZoom={1.8}
            filterZoomEvent={() => false}
          >
            <Geographies geography={GeographyData}>
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    strokeWidth={0.4}
                    pointerEvents="none"
                    className="fill-border-overlay stroke-border-muted dark:fill-surface-300 dark:stroke-surface-100"
                    style={{
                      default: { outline: 'none' },
                      hover: { outline: 'none' },
                      pressed: { outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>

            {/* Inactive Global Cloud / Edge Regions */}
            {GLOBAL_REGIONS.map((region) => {
              const isPrimary =
                Math.abs(region.coordinates[0] - coordinates[0]) < 2 &&
                Math.abs(region.coordinates[1] - coordinates[1]) < 2

              if (isPrimary) return null

              return (
                <Marker
                  key={region.key}
                  coordinates={region.coordinates}
                  onMouseEnter={() =>
                    setHoveredRegion({
                      name: region.name,
                      flag: region.flag,
                      isPrimary: false,
                    })
                  }
                  onMouseLeave={() => setHoveredRegion(null)}
                >
                  <circle
                    r={2.8}
                    className="fill-foreground-lighter/50 hover:fill-foreground cursor-pointer transition-colors stroke-[0.8] stroke-background"
                  />
                </Marker>
              )
            })}

            {/* Primary Active Server Deployment Region */}
            <Marker
              coordinates={coordinates}
              onMouseEnter={() =>
                setHoveredRegion({
                  name: label,
                  flag: '🇸🇬',
                  isPrimary: true,
                })
              }
              onMouseLeave={() => setHoveredRegion(null)}
            >
              <circle
                r={9}
                className="animate-ping fill-brand opacity-40 pointer-events-none"
              />
              <circle
                r={4.8}
                className="fill-brand stroke-2 stroke-background cursor-pointer drop-shadow-sm"
              />
            </Marker>
          </ZoomableGroup>
        </ComposableMap>
      </div>

      {/* Region Status Label / Tooltip */}
      <div className="text-[11px] font-mono text-foreground-light mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-100/90 border border-default shadow-xs backdrop-blur-xs transition-all">
        {hoveredRegion ? (
          <>
            <span>{hoveredRegion.flag || '📍'}</span>
            <span className={hoveredRegion.isPrimary ? 'text-brand font-medium' : 'text-foreground'}>
              {hoveredRegion.name}
            </span>
            <span className="text-foreground-lighter text-[10px]">
              {hoveredRegion.isPrimary ? '(Active Primary)' : '(Available Region)'}
            </span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-brand inline-block animate-pulse" />
            <span className="text-foreground font-medium">{label}</span>
            <span className="text-foreground-lighter text-[10px]">· Primary Active Host</span>
          </>
        )}
      </div>
    </div>
  )
}
