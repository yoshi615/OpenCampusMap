let map; // グローバル変数として定義

// Remove the DOMContentLoaded wrapper and let getdata.js handle initialization
function init() {

	let slideIndex = 1;

	function plusSlides(n) {
		showSlides(slideIndex += n);
	}

	function showSlides(n) {
		let i;
		let slides = document.getElementsByClassName("mySlides");
		if (slides.length === 0) return; // スライドが存在しない場合は処理をスキップ
		if (n > slides.length) {slideIndex = 1}
		if (n < 1) {slideIndex = slides.length}
		for (i = 0; i < slides.length; i++) {
			slides[i].style.display = "none";  
		}
		slides[slideIndex-1].style.display = "block";  
	}

	// 矢印ボタンのクリックイベントを設定
	document.addEventListener('click', (event) => {
		if (event.target.matches('.prev')) {
			plusSlides(-1);
		} else if (event.target.matches('.next')) {
			plusSlides(1);
		}
	});
	
	let lastClickedMarker = null; // 最後にクリックしたマーカーを追跡
	// 言語切り替え設定
	 let currentLanguage = 'japanese'; // 初期言語
	function setLanguage(language) {
		currentLanguage = language;
		regenerateLeftPanel(); // 左パネルを再生成
	}

	function updateTextContent() { // ここを追加
		const elements = document.querySelectorAll('[data-japanese], [data-english]');
		elements.forEach(element => {
			if (currentLanguage === 'japanese') {
				element.textContent = element.getAttribute('data-japanese');
			} else {
				element.textContent = element.getAttribute('data-english');
			}
		});
	}

	// Replace language button event listener with toggle
	document.getElementById('languageToggle').addEventListener('change', function(e) {
		const newLanguage = e.target.checked ? 'english' : 'japanese';
		// Update all translatable elements
		document.querySelectorAll('[data-ja], [data-en]').forEach(element => {
			element.textContent = element.getAttribute(newLanguage === 'english' ? 'data-en' : 'data-ja');
		});
		setLanguage(newLanguage);
		
		// Update tools button text
		const isVisible = mapTools.classList.contains('visible');
		toolsToggle.textContent = newLanguage === 'english' 
			? (isVisible ? 'Hide Tools' : 'Show Tools')
			: (isVisible ? 'ツールを非表示' : 'ツールを表示');
	});

	// 初期メッセージを設定
	  document.getElementById('info').innerHTML = '言語の選択とアイコンをクリックまたはタップして詳細を表示';
		const element = document.getElementById('info');

		// 要素の位置を少し下げる
		element.style.marginTop = '20px';

	// すべてのマーカーの平均緯度と経度を計算
	let latSum = 0;
	let lonSum = 0;

	// データを取得
	let rows = data.main.values;
	let allRows = data.main.values; // 全データを保持

	// 検索ボックスのイベントリスナーを追加
	const markerSearch = document.getElementById('marker-search');
	if (markerSearch) {
		markerSearch.addEventListener('input', function(e) {
			const keyword = e.target.value.trim().toLowerCase();
			if (!keyword) {
				rows = allRows;
			} else {
				rows = allRows.filter(row => {
					const jName = (row[2] || '').toLowerCase();
					const eName = (row[3] || '').toLowerCase();
					return jName.includes(keyword) || eName.includes(keyword);
				});
			}
			initMap(true); // 位置を維持して再描画
		});
	}
	let markers = [];
	initMap();

	// current marker idの変数
	let currentMarkerId = null;

	function initMap(preservePosition = false) {
		// Calculate initial center coordinates regardless of preservePosition
		latSum = 0;
		lonSum = 0;
		let validPoints = 0;

		let bounds = new maplibregl.LngLatBounds();

		rows.forEach(row => {
			const [, , , , lat, lon] = row;
			if (lat && lon) {
			latSum += parseFloat(lat);
			lonSum += parseFloat(lon);
			validPoints++;
			bounds.extend([parseFloat(lon), parseFloat(lat)]);
			}
		});

		// Default center coordinates if no valid points
		let centerLat = 35.8309;  // Default latitude (Reitaku area)
		let centerLon = 139.9534; // Default longitude (Reitaku area)

		if (validPoints > 0) {
			centerLat = latSum / validPoints;
			centerLon = lonSum / validPoints;
		}

		// Get current view state if preserving position
		const currentCenter = preservePosition && map ? map.getCenter() : null;
		const currentZoom = preservePosition && map ? map.getZoom() : null;

		// Clear existing markers
		markers.forEach(marker => marker.remove());
		markers = [];

		// Initialize or update map
		if (!map) {
			map = new maplibregl.Map({
			container: 'map',
			style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
			center: [centerLon, centerLat],
			// zoom: 15
			});
			if (validPoints > 0) {
			map.fitBounds(bounds, { padding: 40 });
			}
		} else if (!preservePosition) {
			map.setCenter([centerLon, centerLat]);
			if (validPoints > 0) {
			map.fitBounds(bounds, { padding: 40 });
			}
		}

		// Restore previous view if preserving position
		if (preservePosition && currentCenter && currentZoom) {
			map.setCenter(currentCenter);
			map.setZoom(currentZoom);
		}

		const mapDropdown = document.getElementById('map-style-dropdown');
		const mapStyles = {
			'normal': 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
			'2023': {
				version: 8,
				sources: {
					'google-satellite': {
						type: 'raster',
						tiles: [
							'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
						],
						tileSize: 256,
						attribution: '© Google'
					}
				},
				layers: [
					{
						id: 'google-satellite-layer',
						type: 'raster',
						source: 'google-satellite',
						minzoom: 0,
						maxzoom: 18
					}
				]
			},
			'1974': 'gazo1',
			'1961': 'ort_old10',
			'1979': 'gazo2',
			'1984': 'gazo3',
			'1987': 'gazo4',
			'2008': 'nendophoto2008',
			'2012': 'nendophoto2012',
			'2014': 'nendophoto2014',
			'2019': 'nendophoto2019'
		};

		mapDropdown.addEventListener('change', () => {
			const year = mapDropdown.value;
			let style = mapStyles[year];

			if (year === 'normal' || year === '2023') {
			map.setStyle(style);
			} else {
			map.setStyle({
				version: 8,
				sources: {
				gsi: {
					type: 'raster',
					tiles: [
					`https://cyberjapandata.gsi.go.jp/xyz/${style}/{z}/{x}/{y}.${style === 'ort_old10' ? 'png' : (style.startsWith('nendophoto') ? 'png' : 'jpg')}`
					],
					tileSize: 256
				}
				},
				layers: [{
				id: 'gsi-layer',
				type: 'raster',
				source: 'gsi',
				minzoom: 0,
				maxzoom: 18
				}]
			});
			}
		});

		

		// マーカーをマップに追加
		rows.forEach((row, index) => {
			const [id, category, jName, eName, lat, lon, jDescription, eDescription, link, hashutagu, linkname, numphotos] = row;
			
			const rphotos = Array.from({length: numphotos}, (_, i) => 
				`<div class="mySlides fade"><img src="images/reitaku-${id}-${i + 1}.jpg" style="width:100%;height:350px;object-fit:cover"></div>`
			).join('');

			const markerConfig = {
				4: { image: 'reitaku-ex-1.jpg', size: '25px', radius: '50%' },
				5: { image: 'reitaku-ex-2.jpg', size: '25px', radius: '0%' },
				0: { image: `reitaku-${id}-1.jpg`, size: '40px', radius: '50%', zIndex: '1000' }
			};

			const customMarker = document.createElement('div');
			const config = markerConfig[category] || { 
				image: `reitaku-${id}-1.jpg`, 
				size: '40px', 
				radius: '50%',
				zIndex: index
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
				event.stopPropagation(); // ←これを追加
				// If same marker is clicked again, do nothing
				if (lastClickedMarker === marker) {
					document.getElementById('info').innerHTML = 'マーカーをクリックまたはタップして詳細を表示';
					lastClickedMarker = null;
				} else {
					const arrows = numphotos > 1 ? `
						<a class="prev" onclick="plusSlides(-1)">&#10094;</a>
						<a class="next" onclick="plusSlides(1)">&#10095;</a>
					` : '';
					
					document.getElementById('info').innerHTML = `
						<h2>${currentLanguage === 'japanese' ? jName : eName}</h2>
						<p>${currentLanguage === 'japanese' ? jDescription : eDescription}</p>
						<a href="${link}" target="_blank">${linkname}</a>
						<div class="slideshow-container">
							${rphotos}
							${arrows}
						</div>
					`;
					lastClickedMarker = marker;
					showSlides(1);  // Reset to first slide when marker is clicked
				}

				currentMarkerId = id;
				const leftPanel = document.getElementById('left-panel');
				
				// Reset slide index when new marker is clicked
				slideIndex = 1;
				
				// Remove closed class to show panel
				leftPanel.classList.remove('closed');
				document.body.classList.add('panel-open');
				
				// Adjust map height for mobile
				if (window.innerWidth <= 767) {
					setTimeout(() => {
						map.resize();
					}, 300);
				}
				
				const arrows = numphotos > 1 ? `
					<a class="prev" onclick="plusSlides(-1)">&#10094;</a>
					<a class="next" onclick="plusSlides(1)">&#10095;</a>
				` : '';
				
				document.getElementById('info').innerHTML = `
					<h2>${currentLanguage === 'japanese' ? jName : eName}</h2>
					<p>${currentLanguage === 'japanese' ? jDescription : eDescription}</p>
					<a href="${link}" target="_blank">${linkname}</a>
					<div class="slideshow-container">
						${rphotos}
						${arrows}
					</div>
				`;
				lastClickedMarker = marker;
				showSlides(1);  // Reset to first slide when marker is clicked
			});
		});

		
	}
	// create a function that regenerates the left panel based on the current marker id
	function regenerateLeftPanel() {
		// find the row that matches the current marker id
		const row = rows.find(row => row[0] === currentMarkerId);
		if (!row) return; // if no row is found, exit the function

		const [id, category, jName, eName, lat, lon, jDescription, eDescription,link,hashutagu,linkname,numphotos] = row;
		var rphotos = ''; // Object to store dynamically created variables

		for (let i = 1; i <= numphotos; i++) {
			rphotos+=`<div class="mySlides fade"><img src="images/reitaku-${id}-${i}.jpg" style="width:100%;height:350px;object-fit:cover"></div> `;
		}

		const arrows = numphotos > 1 ? `
			<a class="prev" onclick="plusSlides(-1)">&#10094;</a>
			<a class="next" onclick="plusSlides(1)">&#10095;</a>
		` : '';

		const description = currentLanguage === 'japanese' ? jDescription : eDescription;
		const name = currentLanguage === 'japanese' ? jName : eName;
		document.getElementById('info').innerHTML = `
			<h2>${name}</h2>
			<p>${description}</p>
			<a href="${link}" target="_blank">${linkname}</a>
			<div class="slideshow-container">
				${rphotos}
				${arrows}
			</div>
			
		`;
		showSlides(1);  // Reset to first slide when panel is regenerated
	}

	// 初期設定
	// filter rows based on marker-filter dropdown
	// Replace the 3D button event listeners with this:
	document.getElementById('threeDToggle').addEventListener('change', function(e) {
		if (e.target.checked) {
			addGeoJsonLayer();
		} else {
			removeGeoJsonLayer();
		}
	});

	// Replace dropdown event listener with checkbox handler
	const markerFilter = document.getElementById('marker-filter');
	markerFilter.addEventListener('change', function(e) {
		console.log('Checkbox changed');
		if (!e.target.matches('input[type="checkbox"]')) return;
		
		// Get all checked categories
		const checkedCategories = Array.from(markerFilter.querySelectorAll('input[type="checkbox"]:checked'))
			.map(checkbox => parseInt(checkbox.value));
		
		// Filter rows to show only checked categories
		rows = data.main.values.filter(row => checkedCategories.includes(parseInt(row[1])));
		
		initMap(true); // Pass true to preserve position
	});

	// Add check all/uncheck all functionality
	document.getElementById('check-all').addEventListener('click', (e) => {
		e.preventDefault();
		markerFilter.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
			checkbox.checked = true;
		});
		// Update the markers
		rows = data.main.values;
		initMap(true);
	});

	document.getElementById('uncheck-all').addEventListener('click', (e) => {
		e.preventDefault();
		markerFilter.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
			checkbox.checked = false;
		});
		// Clear all markers
		rows = [];
		initMap(true);
	});

	// Add panel toggle functionality
	const leftPanel = document.getElementById('left-panel');
	const panelHandle = document.getElementById('panel-handle');

	panelHandle.addEventListener('click', () => {
		leftPanel.classList.toggle('closed');
		document.body.classList.toggle('panel-open');
		
		if (window.innerWidth <= 767) {
			setTimeout(() => {
				map.resize();
			}, 300);
		}
	});

	// Add tools panel toggle functionality
	const toolsToggle = document.getElementById('tools-toggle');
	const mapTools = document.getElementById('map-tools');
	
	toolsToggle.addEventListener('click', () => {
		const isVisible = mapTools.classList.contains('visible');
		mapTools.classList.toggle('visible');
		toolsToggle.textContent = currentLanguage === 'japanese' 
			? (isVisible ? 'ツールを表示' : 'ツールを非表示')
			: (isVisible ? 'Show Tools' : 'Hide Tools');
	});

	// 正門の座標（例：データから取得する場合は自動化してください）
	const GATE_NAME = '正門';
	let gateLat = null, gateLon = null;

	// rowsから正門の座標を取得
	function findGateLatLon() {
		const gateRow = data.main.values.find(row => row[2] === GATE_NAME);
		if (gateRow) {
			gateLat = parseFloat(gateRow[4]);
			gateLon = parseFloat(gateRow[5]);
		}
	}

	// ルートレイヤーを管理
	let routeLayerId = 'osrm-route-layer';
	let routeSourceId = 'osrm-route-source';

	// 地図初期化後にクリックイベントを追加
	function addRouteOnClick() {
		let routePopup = null;
		map.on('click', async (e) => {
			 // クリック地点が既存マーカーの座標と一致する場合はルート検索しない
			const clickLng = e.lngLat.lng;
			const clickLat = e.lngLat.lat;
			const threshold = 0.00005; // 緯度経度の許容誤差（約5m）

			// allRowsは全マーカー情報
			const isMarkerClicked = allRows.some(row => {
				const markerLat = parseFloat(row[4]);
				const markerLon = parseFloat(row[5]);
				return (
					Math.abs(markerLat - clickLat) < threshold &&
					Math.abs(markerLon - clickLng) < threshold
				);
			});

			if (isMarkerClicked) {
				// マーカー上のクリックなら何もしない
				return;
			}
			else if (gateLat === null || gateLon === null) {
				findGateLatLon();
				if (gateLat === null || gateLon === null) {
					alert('正門の座標が見つかりません');
					return;
				}
			}
			const start = [e.lngLat.lng, e.lngLat.lat];
			const end = [gateLon, gateLat];
			// OSRMサーバーのURL（公開サーバー）
			const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`;

			try {
				const res = await fetch(osrmUrl);
				const json = await res.json();
				if (!json.routes || json.routes.length === 0) {
					alert('ルートが見つかりません');
					return;
				}
				const route = json.routes[0].geometry;

				// 既存ルートを削除
				if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
				if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);
				if (routePopup) {
					routePopup.remove();
					routePopup = null;
				}

				// ルートをGeoJSONとして追加
				map.addSource(routeSourceId, {
					type: 'geojson',
					data: {
						type: 'Feature',
						geometry: route
					}
				});
				const distance = json.routes[0].distance; // meters
				const walkingSpeed = 1.3; // m/s (約4.7km/h)
				const durationSeconds = distance / walkingSpeed;
				const durationMinutes = Math.round(durationSeconds / 60);

				const infoDiv = document.getElementById('info');
				if (infoDiv) {
					const distanceKm = (distance / 1000).toFixed(2);
					const timeText = currentLanguage === 'japanese'
						? `距離: ${distanceKm}km<br>徒歩の目安: 約${durationMinutes}分`
						: `Distance: ${distanceKm}km<br>Estimated walk: ~${durationMinutes} min`;
					infoDiv.innerHTML = timeText + '<br>' + infoDiv.innerHTML;
				}
				map.addLayer({
					id: routeLayerId,
					type: 'line',
					source: routeSourceId,
					paint: {
						'line-color': '#adff2f',
						'line-width': 5
					}
				});
				if (route.coordinates && route.coordinates.length > 1) {
					const midIndex = Math.floor(route.coordinates.length / 2);
					const midCoord = route.coordinates[midIndex];
					const popupText = currentLanguage === 'japanese'
						? `徒歩 約${durationMinutes}分`
						: `~${durationMinutes} min walk`;
					routePopup = new maplibregl.Popup({ closeOnClick: false, closeButton: false })
						.setLngLat(midCoord)
						.setHTML(`<div class="custom-popup">${popupText}</div>`)
						.addTo(map);
				}
			} catch (err) {
				alert('経路取得に失敗しました');
				console.error(err);
			}
		});
	}

	addRouteOnClick();

}

// Keep these functions outside init() as they're used globally
function addGeoJsonLayer() {
	map.addSource('geojson-data', {
		type: 'geojson',
		data: 'data/map.geojson'
	});

	map.easeTo({
		pitch: 50, // 地図の傾斜角度を設定
		bearing: -10, // 地図の回転角度を設定
		duration: 1000 // アニメーションの持続時間を設定
	});

	map.addLayer({
		id: 'geojson-layer',
		type: 'fill-extrusion',
		source: 'geojson-data',
		paint: {
			'fill-extrusion-color': '#204e00', // replaced #204e00
			'fill-extrusion-height': ['get', 'height'],
			'fill-extrusion-base': 0,
			'fill-extrusion-opacity': 0.8
		}
	});
}

function removeGeoJsonLayer() {
	map.removeLayer('geojson-layer');
	map.removeSource('geojson-data');
	
	// Restore map to flat view
	map.easeTo({
		pitch: 0,
		bearing: 0,
		duration: 1000
	});
}