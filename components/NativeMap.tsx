import React, { forwardRef } from "react";
import MapView, { Marker, Polygon, Region } from "react-native-maps";
import { Lead, Territory } from "@/lib/types";
import { MapPinMarker } from "./MapPinMarker";

interface NativeMapProps {
  initialRegion: Region;
  locationPermission: boolean;
  leads: Lead[];
  territories?: Territory[];
  selectedLeadId: string | null;
  onMarkerPress: (lead: Lead) => void;
  onLongPress: (e: any) => void;
  showTerritories?: boolean;
}

export const NativeMap = forwardRef<MapView, NativeMapProps>(function NativeMap(
  { initialRegion, locationPermission, leads, territories = [], selectedLeadId, onMarkerPress, onLongPress, showTerritories = true },
  ref
) {
  return (
    <MapView
      ref={ref}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      initialRegion={initialRegion}
      showsUserLocation={locationPermission}
      showsMyLocationButton={false}
      onLongPress={onLongPress}
    >
      {showTerritories && territories
        .filter((territory) => territory.points && Array.isArray(territory.points) && territory.points.length >= 3)
        .map((territory) => (
          <Polygon
            key={territory.id}
            coordinates={territory.points}
            fillColor={territory.color + "25"}
            strokeColor={territory.color}
            strokeWidth={2}
          />
        ))}
      {leads.map((lead) => (
        <Marker
          key={lead.id}
          coordinate={{ latitude: lead.latitude, longitude: lead.longitude }}
          onPress={() => onMarkerPress(lead)}
          tracksViewChanges={selectedLeadId === lead.id}
        >
          <MapPinMarker
            status={lead.status}
            isSelected={selectedLeadId === lead.id}
          />
        </Marker>
      ))}
    </MapView>
  );
});
