class FillAPix {
	constructor() {
		this.CELL_SIZE = 22;
		
		this.gameTimer = document.getElementById('game_time');
		this.gameSelection = document.getElementById('game_selector');
		this.gameStarter = document.getElementById('game_starter');
		this.gameField = document.getElementById('game_field');
		this.gameCanvas = document.getElementById('game_canvas');
		this.gameChecker = document.getElementById('game_check');
		this.loadButton = document.getElementById('load_game');
		this.saveButton = document.getElementById('save_game');
		
		this.ctx = this.gameCanvas.getContext('2d');
		this.ctx.font = "bold 12px Verdana";
		this.ctx.textAlign = "center"; 
		
		this.x = 0;
		this.y = 0;
		this.cells = [];
		this.cellFill = [];
		this.gameTime = 0;
		this.gameStarted = false;
		this.timerId = null;
		this.emptyCells = 0;
		this.gameName = '';
		
		this.autoFill = false;
		this.autoFillState = 0;
		
		this.globalStroke = true;
		
		this.initHandlers();
	}
	
	initHandlers() {
		this.gameStarter.onclick = () => {
			this.startGame(this.gameSelection.value);
		};
		
		this.gameCanvas.onmousedown = (e) => this._onMouseDown(e);
		this.gameCanvas.onmouseup = (e) => this._onMouseUp(e);
		this.gameCanvas.onmouseout = (e) => this._onMouseOut();
		this.gameCanvas.onmousemove = (e) => this._onMouseMove(e);
		this.gameCanvas.oncontextmenu = (e) => this._onMouseRightClick(e);
		
		this.gameChecker.onclick = () => this.checkGame();
		this.loadButton.onclick = () => this.loadGame();
		this.saveButton.onclick = () => this.saveGame();
	}
	
	_onMouseRightClick(e) {
		e.stopPropagation();
		e.preventDefault();
		
		const x = Math.abs(parseInt((e.offsetX - 1) / this.CELL_SIZE));
		const y = Math.abs(parseInt((e.offsetY - 1) / this.CELL_SIZE));
		const index = this.getIndex(x, y);
		if (this.cells[index] !== null) {
			let pos = [0, 0, 0];
			
			this.mapAround(x, y, (nx, ny) => {
				pos[this.cellFill[this.getIndex(nx, ny)]]++;
			}, () => true);
			
			if (pos[0] === 0) {
				return;
			}
			
			let total = pos[0] + pos[1] + pos[2];
			let fillType = null;
			if (this.cells[index] === pos[1]) {
				fillType = 2;
			}
			if (total - this.cells[index] == pos[2]) {
				fillType = 1;
			}
			if (fillType !== null) {
				this.globalStroke = false;
				this.mapAround(x, y, (nx, ny) => {
					const i = this.getIndex(nx, ny);
					if (this.cellFill[i] === 0) {
						this.setCellState(nx, ny, fillType);
					}
				}, () => true);
				this.globalStroke = true;
				this.ctx.stroke();
			}
		}
	}
	
	_onMouseDown(e) {
		e.stopPropagation();
		e.preventDefault();

		if (!this.gameStarted || e.button !== 0) {
			return;
		}

		const x = Math.abs(parseInt((e.offsetX - 1) / this.CELL_SIZE));
		const y = Math.abs(parseInt((e.offsetY - 1) / this.CELL_SIZE));

		if (x < 0 || y < 0 || x >= this.x || y >= this.y) {
			return;
		}

		const index = this.getIndex(x, y);
		const state = (this.cellFill[index] + 1) % 3;
		
		this.globalStroke = false;
		this.setCellState(x, y, state);
		this.globalStroke = true;
		this.ctx.stroke();

		this.autoFill = true;
		this.autoFillState = state;
	}
	
	_onMouseUp(e) {
		e.stopPropagation();
		e.preventDefault();

		this.autoFill = false;
	}
	
	_onMouseOut() {
		this.autoFill = false;
	}
	
	_onMouseMove(e) {
		if (!this.autoFill) {
			return;
		}

		const x = Math.abs(parseInt((e.offsetX - 1) / this.CELL_SIZE));
		const y = Math.abs(parseInt((e.offsetY - 1) / this.CELL_SIZE));

		if (x < 0 || y < 0 || x >= this.x || y >= this.y) {
			return;
		}

		const index = this.getIndex(x, y);
		if (this.autoFillState > 0 && this.cellFill[index] !== 0) {
			return;
		}
		if (this.cellFill[index] === this.autoFillState) {
			return;
		}

		this.globalStroke = false;
		this.setCellState(x, y, this.autoFillState);
		this.globalStroke = true;
		this.ctx.stroke();
	}
	
	checkGame() {
		for (let i in this.cells) {
			if (this.cells[i] === null) {
				continue;
			}
			
			const x = i % this.x;
			const y = parseInt(i / this.x);
			let summary = [0, 0, 0];
			this.mapAround(x, y, (nx, ny) => summary[this.cellFill[this.getIndex(nx, ny)]]++, () => -1);
			
			if (summary[0] === 0 && summary[1] !== this.cells[i]) {
				this.drawError(x, y);
			}
		}
	}
	
	setCellState(x, y, state) {
		const index = this.getIndex(x, y);
		
		if (this.cellFill[index] === 0 && state !== 0) {
			this.emptyCells--;
		} else if (this.cellFill[index] !== 0 && state === 0) {
			this.emptyCells++;
		}
		this.cellFill[index] = state;
		
		this.mapAround(x, y, (nx, ny) => this.drawCell(nx, ny), () => false);
		
		if (this.emptyCells === 0 && this.isFinishedGame()) {
			this.finishGame();
			this.deleteSavedGame();
		}
	}
	
	async startGame(gameName) {
		if (this.gameStarted) {
			this.finishGame();
		}
		
		this.gameName = gameName;
		
		let response = await fetch('./boards/' + this.gameName + '.json');
		let data = await response.json();
		
		this.x = data.x;
		this.y = data.y;
		this.cells = data.cells;
		this.cellFill = Array(this.cells.length);
		this.cellFill.fill(0);
		this.emptyCells = this.x * this.y;
		this.gameTime = 0;
		this.gameField.style.display = 'block';
		this.timerId = setInterval(() => this.gameTick(), 1000);
		this.gameStarted = true;
		this.loadButton.disabled = !this.isHaveSave();
		this.saveButton.disabled = false;

		this.initCanvas();
		this.drawGameTimeStr();
	}
	
	loadGame() {
		let data = this.getSavedData();
		if (data === null) {
			return null;
		}
		
		data = JSON.parse(data);
		
		this.gameTime = data.gameTime;
		this.emptyCells = data.emptyCells;
		this.cellFill = data.cellFill;
		
		this.initCanvas();
	}
	
	saveGame() {
		if (!this.gameStarted) {
			return;
		}
		
		let data = {
			gameTime: this.gameTime,
			emptyCells: this.emptyCells,
			cellFill: this.cellFill,
		};
		
		localStorage.setItem(this._getSavedDataKey(), JSON.stringify(data));
		this.loadButton.disabled = false;
		
		alert('Game saved');
	}
	
	deleteSavedGame() {
		localStorage.removeItem(this._getSavedDataKey());
		this.loadButton.disabled = true;
	}
	
	initCanvas() {
		const width = this.CELL_SIZE * this.x + 2;
		const height = this.CELL_SIZE * this.y + 2;
		this.gameCanvas.width = width;
		this.gameCanvas.height = height;
		
		this.ctx.strokeStyle = "#666";
		this.ctx.rect(0.5, 0.5, width - 1, height - 1);
		this.ctx.stroke();
		
		for (let x = 0; x < this.x; ++x) {
			for (let y = 0; y < this.y; ++y) {
				this.drawCell(x, y, false);
			}
		}
		this.ctx.stroke();
	}
	
	isHaveSave() {
		return (this.getSavedData() !== null);
	}
	
	getSavedData() {
		return localStorage.getItem(this._getSavedDataKey());
	}
	
	_getSavedDataKey() {
		return 'fillapix_save_' + this.gameName;
	}
	
	drawCell(x, y, stroke = true) {
		if (x < 0 || y < 0 || x >= this.x || y >= this.y) {
			return;
		}
		
		const index = y * this.x + x;
		
		this.ctx.fillStyle = (this.cellFill[index] === 0 ? '#fff' : (this.cellFill[index] === 1 ? '#000' : '#ddd'));
		this.ctx.fillRect(1.5 + x * this.CELL_SIZE, 1.5 + y * this.CELL_SIZE, this.CELL_SIZE - 1, this.CELL_SIZE - 1);
		
		this.ctx.strokeStyle = "#666";
		this.ctx.rect(1.5 + x * this.CELL_SIZE, 1.5 + y * this.CELL_SIZE, this.CELL_SIZE - 1, this.CELL_SIZE - 1);
		
		if (this.cells[index] !== null) {
			this.ctx.font = "bold 12px Verdana";
			this.ctx.textAlign = "center"; 
			this.ctx.fillStyle = this.isFinishedCell(x, y) ? '#bbb' : (this.cellFill[index] === 1 ? '#fff' : '#000');
			this.ctx.fillText(
				this.cells[index], 
				1 + x * this.CELL_SIZE + this.CELL_SIZE / 2,
				1 + y * this.CELL_SIZE + this.CELL_SIZE * 0.72,
			);
		}
		if (stroke && this.globalStroke) {
			this.ctx.stroke();
		}
	}
	
	drawError(x, y) {
		const index = y * this.x + x;
		this.ctx.font = "bold 12px Verdana";
		this.ctx.textAlign = "center"; 
		this.ctx.fillStyle = '#f00';
		this.ctx.fillText(
			this.cells[index], 
			1 + x * this.CELL_SIZE + this.CELL_SIZE / 2,
			1 + y * this.CELL_SIZE + this.CELL_SIZE * 0.72,
		);
	}
	
	finishGame() {
		this.gameStarted = false;
		this.autoFill = false;
		clearInterval(this.timerId);
		this.timerId = null;
		this.loadButton.disabled = true;
		this.saveButton.disabled = true;
	}
	
	gameTick() {
//		if (!this.gameStarted) {
//			return;
//		}
		this.gameTime++;
		this.drawGameTimeStr();
	}
	
	drawGameTimeStr() {
        const hh = parseInt(this.gameTime / 3600);
        const mm = parseInt((this.gameTime - hh*3600)/60);

        let shh = String(hh);
        if (shh.length === 1) {
			shh = '0' + shh;
		}
        let smm = String(mm);
        if (smm.length === 1) {
			smm = '0' + smm;
		}
        let sss = String(this.gameTime % 60);
        if (sss.length === 1) {
			sss = '0' + sss;
		}
        this.gameTimer.innerHTML = shh+':'+smm+':'+sss;
	}
	
	isFinishedCell(x, y) {
		const num = this.mapAround(x, y, (nx, ny) => this.cellFill[this.getIndex(nx, ny)] > 0 ? 1: 0, () => 1)
			.reduce((sum, x) => sum + x);
		return (num === 9);
	}
	
	isFinishedGame() {
		if (this.emptyCells > 0) {
			return false;
		}
		
		let isFinished = true;
		for (let i in this.cells) {
			if (this.cells[i] === null) {
				continue;
			}
			
			const x = i % this.x;
			const y = parseInt(i / this.x);
			const num = this.mapAround(x, y, (nx, ny) => this.cellFill[this.getIndex(nx, ny)] === 1 ? 1: 0, () => 0)
				.reduce((sum, x) => sum + x);
			if (num !== this.cells[i]) {
				isFinished = false;
				break;
			}
		}
		
		return isFinished;
	}
	
	mapAround(x, y, func, out) {
		return [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1]].map(dis => {
			const nx = x + dis[0];
			const ny = y + dis[1];
			
			if (nx < 0 || ny < 0 || nx >= this.x || ny >= this.y) {
				return out();
			}
			
			return func(nx, ny);
		});
	}
	
	getIndex(x, y) {
		return y * this.x + x;
	}
}

const game = new FillAPix();