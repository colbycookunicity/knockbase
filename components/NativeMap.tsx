import React, { forwardRef } from "react";
import MapView, { Marker, Region } from "react-native-maps";
import { Lead } from "@/lib/types";
import { MapPinMarker } from "./MapPinMarker";

interface NativeMapProps {
  initialRegion: Region;
  locationPermission: boolean;
  leads: Lead[];
  selectedLeadId: string | null;
  onMarkerPress: (lead: Lead) => void;
  onLongPress: (e: any) => void;
}

export const NativeMap = forwardRef<MapView, NativeMapProps>(function NativeMap(
  { initialRegion, locationPermission, leads, selectedLeadId, onMarkerPress, onLongPress },
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
      {leads.map((lead) => (
        <Marker
          key={lead.id}
          coordinate={{ latitude: lead.latitude, longitude: lead.longitude }}
          onPress={() => onMarkerPress(lead)}
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
