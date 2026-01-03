// Mobile nav
document.addEventListener('DOMContentLoaded', () => {
	mobileNav();
});

function mobileNav() {
	const navBtn = document.querySelector('.mobile-nav-btn');
	const nav = document.querySelector('.mobile-nav');
	const menuIcon = document.querySelector('.nav-icon');
	const navLinks = document.querySelectorAll('.mobile-nav a:not(.accordion-header)');

	if (!navBtn || !nav) {
		console.warn('Mobile nav elements not found');
		return;
	}

	navBtn.addEventListener('click', (e) => {
		e.stopPropagation();
		nav.classList.toggle('mobile-nav--open');
		menuIcon.classList.toggle('nav-icon--active');
		document.body.classList.toggle('no-scroll');
	});

	navLinks.forEach(link => {
		link.addEventListener('click', () => {
			nav.classList.remove('mobile-nav--open');
			if (menuIcon) menuIcon.classList.remove('nav-icon--active');
			document.body.classList.remove('no-scroll');

			document.querySelectorAll('.accordion-item').forEach(item => {
				item.classList.remove('open');
			});
		});
	});

	document.addEventListener('click', (e) => {
		if (nav.classList.contains('mobile-nav--open') &&
			!nav.contains(e.target) &&
			!navBtn.contains(e.target)) {
			nav.classList.remove('mobile-nav--open');
			menuIcon.classList.remove('nav-icon--active');
			document.body.classList.remove('no-scroll');
		}
	});
}



// Accordion
document.addEventListener('click', (e) => {
	const allItems = document.querySelectorAll('.accordion-item');
	const isHeaderClick = e.target.closest('.accordion-header');
	const currentItem = e.target.closest('.accordion-item');

	if (isHeaderClick) {
		e.preventDefault();
		const parent = isHeaderClick.parentElement;

		allItems.forEach(item => {
			if (item !== parent) item.classList.remove('open');
		});

		parent.classList.toggle('open');
		return;
	}

	if (!currentItem || e.target.closest('.nav-column a')) {
		allItems.forEach(item => item.classList.remove('open'));
	}
});

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape') {
		document.querySelectorAll('.accordion-item').forEach(item => item.classList.remove('open'));
	}
});



// Slider
import Swiper from 'swiper';
import { Autoplay } from 'swiper/modules';

const verticalSlider = new Swiper('.my-vertical-slider', {
	modules: [Autoplay],
	direction: 'vertical',    // Вертикальная ориентация
	loop: true,               // Зацикленность
	spaceBetween: 10,         // Расстояние между слайдами
	slidesPerView: 6,         // Сколько карточек видно сразу
	speed: 3000,              // Скорость перехода (5 секунд — очень плавно)
	allowTouchMove: false,    // Отключаем возможность тянуть мышкой (для эффекта ленты)

	autoplay: {
		delay: 0,               // Задержка между переходами 0
		disableOnInteraction: false,
	},
});