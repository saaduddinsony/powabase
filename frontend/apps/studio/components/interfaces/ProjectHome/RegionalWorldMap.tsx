import { useRouter } from 'next/router'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'

interface RegionalWorldMapProps {
  coordinates?: [number, number]
  label?: string
}

export function RegionalWorldMap({
  coordinates = [8.6821, 50.1109],
  label = 'Primary Host',
}: RegionalWorldMapProps) {
  const router = useRouter()
  const geoUrl = `${router.basePath}/json/worldmap.json`

  return (
    <div className="w-full h-full flex flex-col items-center justify-center my-auto py-2 z-10">
      <ComposableMap
        projectionConfig={{ scale: 125, center: [15, 10] }}
        width={620}
        height={260}
        className="w-full h-full max-h-[220px] select-none"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="currentColor"
                className="text-surface-200 dark:text-surface-300 outline-none"
                stroke="var(--border-default)"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { outline: 'none', fill: 'var(--background-surface-300)' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>
        <Marker coordinates={coordinates}>
          <circle r={3.5} fill="#10b981" />
          <circle r={7.5} fill="#10b981" opacity={0.35} className="animate-ping" />
        </Marker>
      </ComposableMap>
      <div className="text-[11px] font-mono text-foreground-lighter mt-1 flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
        <span>{label}</span>
      </div>
    </div>
  )
}
