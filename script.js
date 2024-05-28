// Initialize the map
var map = L.map('map');

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Function to get color based on rental count
function getColor(d) {
    return d > 250 ? '#800026' :
           d > 100 ? '#BD0026' :
           d > 50  ? '#E31A1C' :
           d > 20  ? '#FC4E2A' :
           d > 10  ? '#FD8D3C' :
           d > 5   ? '#FEB24C' :
           d > 0   ? '#FED976' :
                     '#FFEDA0';
}

// Variable to hold the polyline layers
var allPlacesLayer = L.layerGroup();
var filteredPlacesLayer = L.layerGroup();
var filteredRentalLinesLayerGroup = L.layerGroup();
var currentHighlightedPlaceId = null;

// Load the data
Promise.all([
    fetch('data/places_data.json').then(response => response.json()),
    fetch('data/rentals_data.json').then(response => response.json())
]).then(([places, rentals]) => {

    // Calculate the bounds
    var bounds = L.latLngBounds(places.map(place => [place.latitude, place.longitude]));
    console.log('Bounds:', bounds);

    // Add bubbles to the map
    places.forEach(place => {
        var marker = createPlaceMarker(place, place.start_count, place.end_count);
        marker.addTo(allPlacesLayer);
    });

    map.addLayer(allPlacesLayer);

    function formatDuration(duration) {
        var minutes = Math.floor((duration % 3600) / 60);
        var seconds = duration % 60;
        return [minutes, seconds].map(val => String(val).padStart(2, '0')).join(':');
    }

    function createPlaceMarker(place, start_count, end_count) {
        start_count = Number.parseInt(start_count);
        end_count = Number.parseInt(end_count);

        var radius = 20;
        var color = getColor(start_count + end_count);

        // Create a div icon with rental number
        var icon = L.divIcon({
            className: 'circle-label',
            html: `<div style="
                background-color: ${color};
                width: ${radius * 2}px;
                height: ${radius * 2}px;
                border-radius: ${radius}px;
                display: flex;
                align-items: center;
                justify-content: center;
            ">${start_count} | ${end_count}</div>`
        });

        var marker = L.marker([place.latitude, place.longitude], { icon: icon });
        marker.on('click', function () {
            showRentalLinesForPlace(place.id);
        });
        return marker;
    }

    function addArrowhead(latlng) {
        return L.marker(latlng, {
            icon: L.divIcon({
                className: 'arrowhead',
                html: '<div style="transform: rotate(45deg);">&#x25B2;</div>',
                iconSize: [10, 10],
                iconAnchor: [5, 5]
            })
        }).addTo(filteredRentalLinesLayerGroup);
    }

    // Function to create curved line between two points
    function createCurvedLine(startLatLng, endLatLng) {
        var latlngs = [
            'M', [startLatLng.lat, startLatLng.lng],
            'C', 
            [startLatLng.lat, (startLatLng.lng + endLatLng.lng) / 2],
            [(startLatLng.lat + endLatLng.lat) / 2, startLatLng.lng],
            [endLatLng.lat, endLatLng.lng]
        ];
        return L.curve(latlngs, {
            color: 'red',
            weight: 3,
            opacity: 0.7
        });
    }

    // Function to show rental lines for a specific place
    function showRentalLinesForPlace(placeId) {
        // Clear previous filtered lines
        filteredRentalLinesLayerGroup.clearLayers();
        filteredPlacesLayer.clearLayers();
        
        if (currentHighlightedPlaceId == placeId) {
            currentHighlightedPlaceId = null;
            map.addLayer(allPlacesLayer);
            return;
        }

        var place = places.find(p => p.id == placeId);
        var marker = createPlaceMarker(place, place.start_count, place.end_count);
        marker.addTo(filteredPlacesLayer);
        map.removeLayer(allPlacesLayer);

        // Group rentals by start and end places (ignoring direction)
        var groupedRentals = {};
        rentals.forEach(rental => {
            if (rental.start_place_id === placeId || rental.end_place_id === placeId) {
                var key = [rental.start_place_id, rental.end_place_id].join('-');
                if (!groupedRentals[key]) {
                    groupedRentals[key] = [];
                }
                groupedRentals[key].push(rental);
            }
        });

        // Add filtered lines for the selected place
        Object.keys(groupedRentals).forEach(key => {
            var [startId, endId] = key.split('-');
            var startPlace = places.find(place => place.id == startId);
            var endPlace = places.find(place => place.id == endId);
            if (startPlace && endPlace) {
                var curvedLine = createCurvedLine(
                    L.latLng(startPlace.latitude, startPlace.longitude),
                    L.latLng(endPlace.latitude, endPlace.longitude)
                );

                // curvedLine.arrowheads({
                //     size: '5%',
                //     frequency: 'end',
                //     fill: true,
                //     yawn: 40
                // });

                //addArrowhead(L.latLng(endPlace.latitude, endPlace.longitude));

                // Sort rentals by duration
                var rentalsForPopup = groupedRentals[key].map(rental => {
                    rental.duration = (new Date(rental.end_time) - new Date(rental.start_time)) / 1000;
                    return rental;
                });

                // Create HTML table for the popup
                var popupContent = `
                    <b>${startPlace.name}</b><br><br>
                    <b>${endPlace.name}</b><br><br>
                    <table class="popup-table">
                        <tr>
                            <th>#</th>
                            <th>Duration</th>
                            <th>Start</th>
                            <th>Bike</th>
                        </tr>
                        ${rentalsForPopup.map((rental, index) => `
                            <tr>
                                <td>${index + 1}</td>
                                <td>${formatDuration(rental.duration)}</td>
                                <td>${rental.start_time}</td>
                                <td>${rental.bike}</td>
                            </tr>
                        `).join('')}
                    </table>
                `;

                var otherPlace = startPlace.id == placeId
                    ? endPlace : startPlace;
                if (otherPlace.id != placeId) {
                    var otherPlaceMarker = createPlaceMarker(otherPlace,
                        rentals.filter(r => r.start_place_id == otherPlace.id && r.end_place_id == placeId).length,
                        rentals.filter(r => r.end_place_id == otherPlace.id && r.start_place_id == placeId).length);
                    otherPlaceMarker.addTo(filteredPlacesLayer);
                }

                curvedLine.bindPopup(popupContent);
                filteredRentalLinesLayerGroup.addLayer(curvedLine);
            }
        });

        // Show filtered lines
        filteredRentalLinesLayerGroup.addTo(map);
        filteredPlacesLayer.addTo(map);
        currentHighlightedPlaceId = placeId;
    }

    // Fit the map to the bounds
    map.fitBounds(bounds);
}).catch(err => console.error('Error fetching data:', err));
