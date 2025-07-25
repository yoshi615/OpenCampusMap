let map, currentLocationMarker = null;

function init() {
	const leftPanel = document.getElementById('left-panel');
	leftPanel.classList.add('closed');
	document.body.classList.remove('panel-open');

	let slideIndex = 1;
	let lastClickedMarker = null;
	let currentLanguage = 'japanese';
	let currentMarkerId = null;
	let markers = [];
	let rows = data.main.values;
	let allRows = data.main.values;

	// Route management
	const routeLayerId = 'osrm-route-layer';
	const routeSourceId = 'osrm-route-source';
	let routePopup = null;
	let isRouteVisible = false;
	const GATE_NAME = '正門';
	let gateLat = null, gateLon = null;

	function plusSlides(n) { showSlides(slideIndex += n); }
	
	function showSlides(n) {
		const slides = document.getElementsByClassName("mySlides");
		if (slides.length === 0) return;
		if (n > slides.length) slideIndex = 1;
		if (n < 1) slideIndex = slides.length;
		Array.from(slides).forEach((slide, i) => {
			slide.style.display = i === slideIndex - 1 ? "block" : "none";
		});
	}

	function setLanguage(language) {
		currentLanguage = language;
		regenerateLeftPanel();
	}

	function updateRouteButtonText() {
		const routeBtn = document.getElementById('route-btn');
		if (routeBtn) {
			routeBtn.textContent = currentLanguage === 'japanese' 
				? (isRouteVisible ? '経路を非表示' : '正門への経路')
				: (isRouteVisible ? 'Hide Route' : 'Route to Gate');
		}
	}

	function findGateLatLon() {
		const gateRow = data.main.values.find(row => row[2] === GATE_NAME);
		if (gateRow) {
			gateLat = parseFloat(gateRow[4]);
			gateLon = parseFloat(gateRow[5]);
		}
	}

	function createMarker(row, index) {
		const [id, category, jName, eName, lat, lon, jDescription, eDescription, link, hashutagu, linkname, numphotos] = row;
		
		const markerConfig = {
			4: { image: 'reitaku-ex-1.jpg', size: '25px', radius: '50%' },
			5: { image: 'reitaku-ex-2.jpg', size: '25px', radius: '0%' },
			0: { image: `reitaku-${id}-1.jpg`, size: '40px', radius: '50%', zIndex: '1000' }
		};

		const customMarker = document.createElement('div');
		const config = markerConfig[category] || { 
			image: `reitaku-${id}-1.jpg`, size: '40px', radius: '50%', zIndex: index
		};

		Object.assign(customMarker.style, {
			backgroundImage: `url(images/${config.image})`,
			width: config.size,
			height: config.size,
			zIndex: config.zIndex || index,
			borderRadius: config.radius,
			backgroundSize: 'cover',
			cursor: 'pointer',
			border: '2px solid white',
			boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
		});

		const marker = new maplibregl.Marker({ element: customMarker })
			.setLngLat([parseFloat(lon), parseFloat(lat)])
			.addTo(map);

		markers.push(marker);
		customMarker.title = currentLanguage === 'japanese' ? jName : eName;

		marker.getElement().addEventListener('click', (event) => {
			event.stopPropagation();
			if (lastClickedMarker === marker) {
				document.getElementById('info').innerHTML = 'マーカーをクリックまたはタップして詳細を表示';
				lastClickedMarker = null;
			} else {
				const rphotos = Array.from({length: numphotos}, (_, i) => 
					`<div class="mySlides fade"><img src="images/reitaku-${id}-${i + 1}.jpg" style="width:100%;height:350px;object-fit:cover"></div>`
				).join('');
				
				const arrows = numphotos > 1 ? `
					<a class="prev" onclick="plusSlides(-1)">&#10094;</a>
					<a class="next" onclick="plusSlides(1)">&#10095;</a>
				` : '';
				
				document.getElementById('info').innerHTML = `
					<h2>${currentLanguage === 'japanese' ? jName : eName}</h2>
					<p>${currentLanguage === 'japanese' ? jDescription : eDescription}</p>
					<a href="${link}" target="_blank">${linkname}</a>
					<div class="slideshow-container">${rphotos}${arrows}</div>
				`;
				lastClickedMarker = marker;
				showSlides(1);
			}

			currentMarkerId = id;
			slideIndex = 1;
			leftPanel.classList.remove('closed');
			document.body.classList.add('panel-open');
			showClosePanelBtn(true);
			
			if (window.innerWidth <= 767) {
				setTimeout(() => map.resize(), 300);
			}
		});
		
		return marker;
	}

	function autoGetCurrentLocation() {
		if (!navigator.geolocation) return;

		navigator.geolocation.getCurrentPosition(
			(position) => {
				const { latitude, longitude } = position.coords;
				const element = document.createElement('div');
				element.className = 'current-location-marker';
				element.style.cssText = `
					width: 30px; height: 30px;
					background-image: url('images/mp_simple_black2.png');
					background-size: cover; background-position: center;
					cursor: pointer; position: relative; z-index: 1001;
				`;
				
				currentLocationMarker = new maplibregl.Marker({ element })
					.setLngLat([longitude, latitude])
					.addTo(map);
			},
			(error) => console.error('Error getting current location:', error),
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
		);
	}

	function initMap(preservePosition = false) {
		let latSum = 0, lonSum = 0, validPoints = 0;
		const bounds = new maplibregl.LngLatBounds();

		rows.forEach(row => {
			const [, , , , lat, lon] = row;
			if (lat && lon) {
				latSum += parseFloat(lat);
				lonSum += parseFloat(lon);
				validPoints++;
				bounds.extend([parseFloat(lon), parseFloat(lat)]);
			}
		});

		const centerLat = validPoints > 0 ? latSum / validPoints : 35.8309;
		const centerLon = validPoints > 0 ? lonSum / validPoints : 139.9534;
		const currentCenter = preservePosition && map ? map.getCenter() : null;
		const currentZoom = preservePosition && map ? map.getZoom() : null;

		markers.forEach(marker => marker.remove());
		markers = [];

		if (!map) {
			map = new maplibregl.Map({
				container: 'map',
				style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
				center: [centerLon, centerLat],
				zoom: 15
			});
			if (validPoints > 0) map.fitBounds(bounds, { padding: 40 });
			map.on('load', () => autoGetCurrentLocation());
		} else if (!preservePosition) {
			map.setCenter([centerLon, centerLat]);
			if (validPoints > 0) map.fitBounds(bounds, { padding: 40 });
		}

		if (preservePosition && currentCenter && currentZoom) {
			map.setCenter(currentCenter);
			map.setZoom(currentZoom);
		}

		// Map style dropdown setup
		const mapDropdown = document.getElementById('map-style-dropdown');
		const mapStyles = {
			'normal': 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
			'2023': {
				version: 8,
				sources: { 'google-satellite': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256, attribution: '© Google' } },
				layers: [{ id: 'google-satellite-layer', type: 'raster', source: 'google-satellite', minzoom: 0, maxzoom: 18 }]
			}
		};

		['1974', '1961', '1979', '1984', '1987', '2008', '2012', '2014', '2019'].forEach(year => {
			mapStyles[year] = year === '1974' ? 'gazo1' : year === '1961' ? 'ort_old10' : 
				year.startsWith('20') ? `nendophoto${year}` : `gazo${parseInt(year) - 1972}`;
		});

		mapDropdown.addEventListener('change', () => {
			const year = mapDropdown.value;
			const style = mapStyles[year];

			if (year === 'normal' || year === '2023') {
				map.setStyle(style);
			} else {
				map.setStyle({
					version: 8,
					sources: { gsi: { type: 'raster', tiles: [`https://cyberjapandata.gsi.go.jp/xyz/${style}/{z}/{x}/{y}.${style === 'ort_old10' ? 'png' : (style.startsWith('nendophoto') ? 'png' : 'jpg')}`], tileSize: 256 } },
					layers: [{ id: 'gsi-layer', type: 'raster', source: 'gsi', minzoom: 0, maxzoom: 18 }]
				});
			}
		});

		// Create markers
		rows.forEach(createMarker);
	}

	function regenerateLeftPanel() {
		const row = rows.find(row => row[0] === currentMarkerId);
		if (!row) return;

		const [id, category, jName, eName, lat, lon, jDescription, eDescription, link, hashutagu, linkname, numphotos] = row;
		const rphotos = Array.from({length: numphotos}, (_, i) => 
			`<div class="mySlides fade"><img src="images/reitaku-${id}-${i + 1}.jpg" style="width:100%;height:350px;object-fit:cover"></div>`
		).join('');

		const arrows = numphotos > 1 ? `
			<a class="prev" onclick="plusSlides(-1)">&#10094;</a>
			<a class="next" onclick="plusSlides(1)">&#10095;</a>
		` : '';

		document.getElementById('info').innerHTML = `
			<h2>${currentLanguage === 'japanese' ? jName : eName}</h2>
			<p>${currentLanguage === 'japanese' ? jDescription : eDescription}</p>
			<a href="${link}" target="_blank">${linkname}</a>
			<div class="slideshow-container">${rphotos}${arrows}</div>
		`;
		showSlides(1);
	}

	function hideRoute() {
		if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
		if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);
		if (routePopup) {
			routePopup.remove();
			routePopup = null;
		}

		const infoDiv = document.getElementById('info');
		if (infoDiv) {
			const lines = infoDiv.innerHTML.split('<br>');
			const filteredLines = lines.filter(line => 
				!['正門までの距離', '徒歩の目安', '自転車の目安', '車での目安', 'Distance to main gate', 'Estimated walk', 'Estimated bike', 'Estimated drive'].some(text => line.includes(text))
			);
			infoDiv.innerHTML = filteredLines.join('<br>');
		}

		isRouteVisible = false;
		updateRouteButtonText();
	}

	function showRouteToGate() {
		if (!currentLocationMarker) {
			alert(currentLanguage === 'japanese' ? '現在地を先に取得してください。' : 'Please get your current location first.');
			return;
		}

		if (gateLat === null || gateLon === null) {
			findGateLatLon();
			if (gateLat === null || gateLon === null) {
				alert(currentLanguage === 'japanese' ? '正門の座標が見つかりません。' : 'Main gate coordinates not found.');
				return;
			}
		}

		const currentPos = currentLocationMarker.getLngLat();
		const start = [currentPos.lng, currentPos.lat];
		const end = [gateLon, gateLat];
		const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;

		const loadingMessage = currentLanguage === 'japanese' ? '経路を検索中...' : 'Searching route...';
		const infoDiv = document.getElementById('info');
		if (infoDiv) infoDiv.innerHTML = loadingMessage + '<br>' + infoDiv.innerHTML;

		fetch(osrmUrl)
			.then(res => res.json())
			.then(json => {
				if (infoDiv) infoDiv.innerHTML = infoDiv.innerHTML.replace(loadingMessage + '<br>', '');

				if (!json.routes || json.routes.length === 0) {
					alert(currentLanguage === 'japanese' ? 'ルートが見つかりません。' : 'Route not found.');
					return;
				}

				const route = json.routes[0].geometry;
				const distance = json.routes[0].distance;
				const distanceKm = distance / 1000;

				if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
				if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);
				if (routePopup) routePopup.remove();

				map.addSource(routeSourceId, {
					type: 'geojson',
					data: { type: 'Feature', geometry: route }
				});

				let timeText, popupText;

				if (distanceKm >= 10) {
					const carDurationMinutes = Math.round((distanceKm / 40) * 60);
					timeText = currentLanguage === 'japanese'
						? `正門までの距離: ${distanceKm.toFixed(2)}km<br>車での目安: 約${carDurationMinutes}分`
						: `Distance to main gate: ${distanceKm.toFixed(2)}km<br>Estimated drive: ~${carDurationMinutes} min`;
					popupText = currentLanguage === 'japanese' ? `車 約${carDurationMinutes}分` : `~${carDurationMinutes} min drive`;
				} else {
					const walkingDurationMinutes = Math.round((distance / 1.3) / 60);
					const bicycleDurationMinutes = Math.round((distanceKm / 15) * 60);
					
					timeText = currentLanguage === 'japanese'
						? `正門までの距離: ${distanceKm.toFixed(2)}km<br>徒歩の目安: 約${walkingDurationMinutes}分<br>自転車の目安: 約${bicycleDurationMinutes}分`
						: `Distance to main gate: ${distanceKm.toFixed(2)}km<br>Estimated walk: ~${walkingDurationMinutes} min<br>Estimated bike: ~${bicycleDurationMinutes} min`;
					popupText = currentLanguage === 'japanese'
						? `徒歩 約${walkingDurationMinutes}分 / 自転車 約${bicycleDurationMinutes}分`
						: `~${walkingDurationMinutes} min walk / ~${bicycleDurationMinutes} min bike`;
				}

				if (infoDiv) infoDiv.innerHTML = timeText + '<br>' + infoDiv.innerHTML;

				map.addLayer({
					id: routeLayerId,
					type: 'line',
					source: routeSourceId,
					paint: { 'line-color': '#adff2f', 'line-width': 5 }
				});

				if (route.coordinates && route.coordinates.length > 1) {
					const midCoord = route.coordinates[Math.floor(route.coordinates.length / 2)];
					routePopup = new maplibregl.Popup({ closeOnClick: false, closeButton: false })
						.setLngLat(midCoord)
						.setHTML(`<div class="custom-popup">${popupText}</div>`)
						.addTo(map);
				}

				isRouteVisible = true;
				updateRouteButtonText();
			})
			.catch(err => {
				if (infoDiv) infoDiv.innerHTML = infoDiv.innerHTML.replace(loadingMessage + '<br>', '');
				alert(currentLanguage === 'japanese' ? '経路取得に失敗しました。' : 'Failed to get route.');
				console.error(err);
			});
	}

	function toggleRouteToGate() {
		isRouteVisible ? hideRoute() : showRouteToGate();
	}

	function showClosePanelBtn(show) {
		const btn = document.getElementById('close-panel-btn');
		if (btn) btn.style.display = show ? 'block' : 'none';
	}

	// Event listeners
	document.addEventListener('click', (event) => {
		if (event.target.matches('.prev')) plusSlides(-1);
		else if (event.target.matches('.next')) plusSlides(1);
	});

	document.getElementById('languageToggle').addEventListener('change', function(e) {
		const newLanguage = e.target.checked ? 'english' : 'japanese';
		document.querySelectorAll('[data-ja], [data-en]').forEach(element => {
			element.textContent = element.getAttribute(newLanguage === 'english' ? 'data-en' : 'data-ja');
		});
		setLanguage(newLanguage);
		
		const mapTools = document.getElementById('map-tools');
		const toolsToggle = document.getElementById('tools-toggle');
		if (mapTools && toolsToggle) {
			const isVisible = mapTools.classList.contains('visible');
			toolsToggle.textContent = newLanguage === 'english' 
				? (isVisible ? 'Hide Tools' : 'Show Tools')
				: (isVisible ? 'ツールを非表示' : 'ツールを表示');
		}
		updateRouteButtonText();
	});

	// Initialize
	document.getElementById('info').innerHTML = '言語の選択とアイコンをクリックまたはタップして詳細を表示';
	document.getElementById('info').style.marginTop = '20px';

	const markerSearch = document.getElementById('marker-search');
	if (markerSearch) {
		markerSearch.addEventListener('input', function(e) {
			const keyword = e.target.value.trim().toLowerCase();
			rows = !keyword ? allRows : allRows.filter(row => {
				const jName = (row[2] || '').toLowerCase();
				const eName = (row[3] || '').toLowerCase();
				return jName.includes(keyword) || eName.includes(keyword);
			});
			initMap(true);
		});
	}

	initMap();

	// More event listeners
	document.getElementById('threeDToggle').addEventListener('change', function(e) {
		e.target.checked ? addGeoJsonLayer() : removeGeoJsonLayer();
	});

	const markerFilter = document.getElementById('marker-filter');
	markerFilter.addEventListener('change', function(e) {
		if (!e.target.matches('input[type="checkbox"]')) return;
		
		const checkedCategories = Array.from(markerFilter.querySelectorAll('input[type="checkbox"]:checked'))
			.map(checkbox => parseInt(checkbox.value));
		rows = data.main.values.filter(row => checkedCategories.includes(parseInt(row[1])));
		initMap(true);
	});

	document.getElementById('check-all').addEventListener('click', (e) => {
		e.preventDefault();
		markerFilter.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = true);
		rows = data.main.values;
		initMap(true);
	});

	document.getElementById('uncheck-all').addEventListener('click', (e) => {
		e.preventDefault();
		markerFilter.querySelectorAll('input[type="checkbox"]').forEach(checkbox => checkbox.checked = false);
		rows = [];
		initMap(true);
	});

	const panelHandle = document.getElementById('panel-handle');
	panelHandle.addEventListener('click', () => {
		leftPanel.classList.toggle('closed');
		document.body.classList.toggle('panel-open');
		if (leftPanel.classList.contains('closed')) showClosePanelBtn(false);
		if (window.innerWidth <= 767) setTimeout(() => map.resize(), 300);
	});

	const toolsToggle = document.getElementById('tools-toggle');
	const mapTools = document.getElementById('map-tools');
	toolsToggle.addEventListener('click', () => {
		const isVisible = mapTools.classList.contains('visible');
		mapTools.classList.toggle('visible');
		toolsToggle.textContent = currentLanguage === 'japanese' 
			? (isVisible ? 'ツールを表示' : 'ツールを非表示')
			: (isVisible ? 'Show Tools' : 'Hide Tools');
	});

	const routeBtn = document.getElementById('route-btn');
	if (routeBtn) routeBtn.addEventListener('click', toggleRouteToGate);

	const closePanelBtn = document.getElementById('close-panel-btn');
	if (closePanelBtn) {
		closePanelBtn.addEventListener('click', () => {
			leftPanel.classList.add('closed');
			document.body.classList.remove('panel-open');
			showClosePanelBtn(false);
		});
	}
}

function addGeoJsonLayer() {
	map.addSource('geojson-data', { type: 'geojson', data: 'data/map.geojson' });
	map.easeTo({ pitch: 50, bearing: -10, duration: 1000 });
	map.addLayer({
		id: 'geojson-layer',
		type: 'fill-extrusion',
		source: 'geojson-data',
		paint: {
			'fill-extrusion-color': '#204e00',
			'fill-extrusion-height': ['get', 'height'],
			'fill-extrusion-base': 0,
			'fill-extrusion-opacity': 0.8
		}
	});
}

function removeGeoJsonLayer() {
	map.removeLayer('geojson-layer');
	map.removeSource('geojson-data');
	map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
}