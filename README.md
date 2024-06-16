<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Klinik Suel Motor - Jasa Servis dan Toko Penjualan Suku Cadang Sepeda Motor</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        header {
            background-color: #2c3e50;
            color: white;
            padding: 10px 0;
            text-align: center;
        }
        nav ul {
            list-style-type: none;
            padding: 0;
            margin: 0;
            text-align: center;
        }
        nav ul li {
            display: inline;
            margin: 0 10px;
        }
        nav ul li a {
            color: white;
            text-decoration: none;
            padding: 10px 15px;
            display: inline-block;
            border-radius: 5px;
            transition: background-color 0.3s ease;
        }
        nav ul li a:hover {
            background-color: #34495e;
        }
        .container {
            padding: 20px;
            background-color: white;
            margin: 20px auto;
            max-width: 800px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
        section {
            margin-bottom: 20px;
        }
        footer {
            background-color: #2c3e50;
            color: white;
            text-align: center;
            padding: 10px 0;
            position: fixed;
            bottom: 0;
            width: 100%;
        }
    </style>
</head>
<body>
    <header>
        <h1>Klinik Suel Motor</h1>
        <nav>
            <ul>
                <li><a href="#">Beranda</a></li>
                <li><a href="#services">Jasa</a></li>
                <li><a href="#products">Produk</a></li>
                <li><a href="#cart">Keranjang</a></li>
                <li><a href="#contact">Kontak</a></li>
            </ul>
        </nav>
    </header>

    <div class="container">
        <section id="home">
            <h2>Selamat Datang di Klinik Suel Motor</h2>
            <p>Kami menyediakan berbagai macam suku cadang motor dan jasa perbaikan berkualitas.</p>
        </section>

        <section id="services">
            <h2>Jasa</h2>
            <div class="service">
                <h3>Servis Lengkap</h3>
                <p>Harga: Rp 75.000</p>
                <p class="description">Layanan servis lengkap untuk memastikan motor Anda selalu dalam kondisi terbaik.</p>
                <button>Pesan Sekarang</button>
            </div>
            <div class="service">
                <h3>Servis Ringan</h3>
                <p>Harga: Rp 45.000</p>
                <p class="description">Layanan servis ringan untuk perawatan rutin motor Anda.</p>
                <button>Pesan Sekarang</button>
            </div>
            <div class="service">
                <h3>Turun Mesin</h3>
                <p>Harga: Rp 150.000</p>
                <p class="description">Jasa turun mesin untuk perbaikan mendalam pada motor Anda.</p>
                <button>Pesan Sekarang</button>
            </div>
            <div class="service">
                <h3>Pembersihan CVT (Kopling)</h3>
                <p>Harga: Rp 25.000</p>
                <p class="description">Jasa pembersihan CVT (kopling) untuk memastikan performa yang optimal.</p>
                <button>Pesan Sekarang</button>
            </div>
        </section>

        <section id="products">
            <h2>Produk</h2>
            <p>Berikut adalah daftar stok produk kami:</p>
            <table>
                <thead>
                    <tr>
                        <th>No.</th>
                        <th>Kode Barang</th>
                        <th>Nama Barang</th>
                        <th>Stok</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Placeholder untuk data stok -->
                    <tr>
                        <td>1</td>
                        <td>IB0000H537</td>
                        <td>HND-82A</td>
                        <td>5</td>
                    </tr>
                    <tr>
                        <td>2</td>
                        <td>IB0000H537</td>
                        <td>HND-28A</td>
                        <td>10</td>
                    </tr>
                    <!-- Tambahkan baris lain sesuai kebutuhan -->
                </tbody>
            </table>
        </section>

        <section id="cart">
            <h2>Keranjang Belanja</h2>
            <p>Keranjang belanja Anda kosong.</p>
            <!-- Daftar item keranjang belanja akan muncul di sini -->
        </section>

        <section id="contact">
            <h2>Kontak Kami</h2>
            <p>Email: smslhadi2@gmail.com</p>
            <p>Telepon: 081917106463</p>
            <p>Alamat: Jl.Bonjeruk-puyung Dusun Batungereng Desa Bunkate Kec. Jonggat Lombok Tengah NTB</p>
        </section>
    </div>

    <footer>
        <p>&copy; 2024 Klinik Suel Motor - Jasa Servis dan Toko Penjualan Suku Cadang Sepeda Motor</p>
    </footer>
</body>
</html>
